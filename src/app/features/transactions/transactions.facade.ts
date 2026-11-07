import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { TransactionSource } from '../../data-access/repositories/transaction-source';
import {
  TransactionChanges,
  TransactionRepository,
} from '../../data-access/repositories/transaction.repository';
import { CreditCard } from '../../shared/models/credit-card';
import {
  Transaction,
  TransactionStatus,
  isCardPurchase,
  isCardRefund,
  isInstallment,
  isInvoicePayment,
  isRefund,
} from '../../shared/models/transaction';
import { TransactionFilters } from '../../shared/models/transaction-query';
import { InstallmentNotEditableError } from '../installments/domain/installment-rules';
import { PaidInvoiceError, isInvoicePaidFor } from '../invoices/domain/invoice-rules';
import { FIELDS_KEPT_WITH_REFUNDS, HasRefundsError } from '../refunds/domain/refund-rules';
import {
  InvalidTransactionInputError,
  TransactionInput,
  assertValidReferences,
  normalizeTransactionInput,
} from './domain/transaction-rules';

export { PaidInvoiceError } from '../invoices/domain/invoice-rules';
export { HasRefundsError } from '../refunds/domain/refund-rules';

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction not found');
    this.name = 'TransactionNotFoundError';
  }
}

type CardMovementRef = Pick<Transaction, 'type' | 'creditCardId' | 'date'>;

/**
 * Casos de uso das transações do usuário logado. As telas pedem só o que exibem (uma página, as
 * recentes, os totais); a lista completa nunca é carregada na build publicada. Pagamentos de
 * fatura são criados pela facade de Faturas; aqui eles só podem ser excluídos (o que desfaz o
 * pagamento).
 */
@Injectable({ providedIn: 'root' })
export class TransactionsFacade {
  private readonly repository = inject(TransactionRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly categories = inject(CategoryRepository);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly auth = inject(AuthService);
  /**
   * Lista completa, só na demonstração e nos testes, para conferir a fatura paga antes de gravar.
   * Na API, o servidor faz a checagem e responde 409 (`PaidInvoiceError`).
   */
  private readonly source = inject(TransactionSource, { optional: true });

  /**
   * As transações mais recentes que passam nos filtros e quantas são no total (por exemplo, as de
   * uma conta ou de um cartão), sem carregar a lista completa.
   */
  async recent(
    filters: TransactionFilters,
    limit: number,
  ): Promise<{ items: Transaction[]; count: number }> {
    const userId = this.userId();
    const [page, totals] = await Promise.all([
      firstValueFrom(
        this.repository.query(userId, { filters, sort: 'date-desc', cursor: null, limit }),
      ),
      firstValueFrom(this.repository.summarize(userId, filters)),
    ]);
    return { items: page.items, count: totals.count };
  }

  /** Retorna `null` se a transação não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<Transaction | null> {
    const transaction = await firstValueFrom(this.repository.findById(id));
    return transaction && transaction.userId === this.userId() ? transaction : null;
  }

  async create(input: TransactionInput): Promise<Transaction> {
    const normalized = normalizeTransactionInput(input);
    await this.validate(normalized);
    const transaction: NewRecord<Transaction> = {
      ...normalized,
      invoiceMonth: null,
      userId: this.userId(),
    };
    return firstValueFrom(this.repository.create(transaction));
  }

  /**
   * `version`: o `updatedAt` do registro quando o formulário o carregou. Só os campos alterados
   * são enviados: numa despesa com estornos, descrição, categoria e observações mudam livremente,
   * e o resto exige excluir os estornos antes (`HasRefundsError`).
   */
  async update(id: string, input: TransactionInput, version?: string): Promise<Transaction> {
    const normalized = normalizeTransactionInput(input);
    const previous = await this.getEditable(id);
    if (isInvoicePayment(previous) || isRefund(previous)) {
      throw new InvalidTransactionInputError('type');
    }
    const changes = changedFields(previous, normalized);
    if (
      Object.keys(changes).some((key) => !FIELDS_KEPT_WITH_REFUNDS.some((kept) => kept === key))
    ) {
      await this.assertNoRefunds(previous);
    }
    await this.validate(normalized, previous);
    return firstValueFrom(this.repository.update(id, changes, version));
  }

  /** Compras no cartão, pagamentos de fatura e estornos são sempre realizados. */
  async setStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const transaction = await this.getEditable(id);
    if (
      (isCardPurchase(transaction) || isInvoicePayment(transaction) || isRefund(transaction)) &&
      status !== 'completed'
    ) {
      throw new InvalidTransactionInputError('status');
    }
    if (status !== transaction.status) {
      await this.assertNoRefunds(transaction);
    }
    return firstValueFrom(this.repository.update(id, { status }));
  }

  /**
   * Exclusão física: o saldo das contas é recalculado a partir das transações restantes. Excluir
   * um pagamento de fatura desfaz o pagamento; uma compra (ou um estorno) de fatura paga não pode
   * ser excluída, nem uma despesa com estornos.
   */
  async delete(id: string): Promise<void> {
    const transaction = await this.getEditable(id);
    await this.assertNoRefunds(transaction);
    await this.assertInvoicesOpen([transaction]);
    await firstValueFrom(this.repository.delete(id));
  }

  /** Referências válidas e, para compras no cartão, faturas (nova e anterior) ainda não pagas. */
  private async validate(input: TransactionInput, previous?: Transaction): Promise<void> {
    const userId = this.userId();
    const [accounts, categories, creditCards] = await Promise.all([
      firstValueFrom(this.accounts.listByUser(userId)),
      firstValueFrom(this.categories.listByUser(userId)),
      firstValueFrom(this.creditCards.listByUser(userId)),
    ]);
    assertValidReferences(input, { accounts, categories, creditCards }, previous);
    await this.assertInvoicesOpen([input, ...(previous ? [previous] : [])], creditCards);
  }

  private async assertInvoicesOpen(
    items: readonly CardMovementRef[],
    cards?: readonly CreditCard[],
  ): Promise<void> {
    const purchases = items.filter((item) => isCardPurchase(item) || isCardRefund(item));
    if (purchases.length === 0 || !this.source) {
      return;
    }
    const userId = this.userId();
    const [creditCards, transactions] = await Promise.all([
      cards ?? firstValueFrom(this.creditCards.listByUser(userId)),
      firstValueFrom(this.source.listByUser(userId)),
    ]);
    for (const purchase of purchases) {
      const card = creditCards.find((item) => item.id === purchase.creditCardId);
      if (card && isInvoicePaidFor(card, transactions, purchase.date)) {
        throw new PaidInvoiceError();
      }
    }
  }

  /** Na demo e nos testes, recusa a despesa com estornos; na API, o servidor responde 409. */
  private async assertNoRefunds(transaction: Transaction): Promise<void> {
    if (transaction.type !== 'expense' || !this.source) {
      return;
    }
    const all = await firstValueFrom(this.source.listByUser(this.userId()));
    if (all.some((item) => item.refundedTransactionId === transaction.id)) {
      throw new HasRefundsError();
    }
  }

  /** Transação do usuário que pode mudar por aqui: uma parcela só muda pela compra parcelada. */
  private async getEditable(id: string): Promise<Transaction> {
    const transaction = await this.getById(id);
    if (!transaction) {
      throw new TransactionNotFoundError();
    }
    if (isInstallment(transaction)) {
      throw new InstallmentNotEditableError();
    }
    return transaction;
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}

/** Campos da transação que o formulário mudou (a API recusa mexer nos que travam com estornos). */
function changedFields(previous: Transaction, input: TransactionInput): TransactionChanges {
  const changes: TransactionChanges = {};
  for (const key of Object.keys(input) as (keyof TransactionInput)[]) {
    if (input[key] !== previous[key]) {
      Object.assign(changes, { [key]: input[key] });
    }
  }
  return changes;
}
