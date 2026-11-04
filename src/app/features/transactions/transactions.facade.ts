import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { CreditCard } from '../../shared/models/credit-card';
import {
  Transaction,
  TransactionStatus,
  isCardPurchase,
  isInvoicePayment,
} from '../../shared/models/transaction';
import { isInvoicePaidFor } from '../invoices/domain/invoice-rules';
import {
  InvalidTransactionInputError,
  TransactionInput,
  assertValidReferences,
  normalizeTransactionInput,
} from './domain/transaction-rules';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction not found');
    this.name = 'TransactionNotFoundError';
  }
}

/** A compra pertence a uma fatura já paga; é preciso desfazer o pagamento antes de alterá-la. */
export class PaidInvoiceError extends Error {
  constructor() {
    super('The invoice of this purchase is already paid');
    this.name = 'PaidInvoiceError';
  }
}

type CardPurchaseRef = Pick<Transaction, 'type' | 'creditCardId' | 'date'>;

/**
 * Casos de uso das transações do usuário logado. Carrega todas as transações do usuário;
 * período, filtros e paginação são aplicados na tela. Pagamentos de fatura são criados pela
 * facade de Faturas; aqui eles só podem ser excluídos (o que desfaz o pagamento).
 */
@Injectable({ providedIn: 'root' })
export class TransactionsFacade {
  private readonly repository = inject(TransactionRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly categories = inject(CategoryRepository);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly auth = inject(AuthService);
  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _status = signal<LoadStatus>('loading');

  readonly transactions = this._transactions.asReadonly();
  readonly status = this._status.asReadonly();

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this._transactions.set([]);
      this._status.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      this._transactions.set(await firstValueFrom(this.repository.listByUser(this.userId())));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se a transação não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<Transaction | null> {
    const transaction = await firstValueFrom(this.repository.findById(id));
    return transaction && transaction.userId === this.userId() ? transaction : null;
  }

  async create(input: TransactionInput): Promise<Transaction> {
    const normalized = normalizeTransactionInput(input);
    await this.validate(normalized);
    const transaction: Transaction = {
      ...normalized,
      invoiceMonth: null,
      id: crypto.randomUUID(),
      userId: this.userId(),
      createdAt: new Date().toISOString(),
    };
    return this.store(await firstValueFrom(this.repository.create(transaction)));
  }

  async update(id: string, input: TransactionInput): Promise<Transaction> {
    const normalized = normalizeTransactionInput(input);
    const previous = await this.getOwned(id);
    if (isInvoicePayment(previous)) {
      throw new InvalidTransactionInputError('type');
    }
    await this.validate(normalized, previous);
    return this.store(await firstValueFrom(this.repository.update(id, normalized)));
  }

  /** Compras no cartão e pagamentos de fatura são sempre realizados. */
  async setStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const transaction = await this.getOwned(id);
    if ((isCardPurchase(transaction) || isInvoicePayment(transaction)) && status !== 'completed') {
      throw new InvalidTransactionInputError('status');
    }
    return this.store(await firstValueFrom(this.repository.update(id, { status })));
  }

  /**
   * Exclusão física: o saldo das contas é recalculado a partir das transações restantes. Excluir
   * um pagamento de fatura desfaz o pagamento; uma compra de fatura paga não pode ser excluída.
   */
  async delete(id: string): Promise<void> {
    const transaction = await this.getOwned(id);
    if (isCardPurchase(transaction)) {
      await this.assertInvoicesOpen([transaction]);
    }
    await firstValueFrom(this.repository.delete(id));
    this._transactions.update((transactions) => transactions.filter((item) => item.id !== id));
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
    items: readonly CardPurchaseRef[],
    cards?: readonly CreditCard[],
  ): Promise<void> {
    const purchases = items.filter(isCardPurchase);
    if (purchases.length === 0) {
      return;
    }
    const userId = this.userId();
    const [creditCards, transactions] = await Promise.all([
      cards ?? firstValueFrom(this.creditCards.listByUser(userId)),
      firstValueFrom(this.repository.listByUser(userId)),
    ]);
    for (const purchase of purchases) {
      const card = creditCards.find((item) => item.id === purchase.creditCardId);
      if (card && isInvoicePaidFor(card, transactions, purchase.date)) {
        throw new PaidInvoiceError();
      }
    }
  }

  private async getOwned(id: string): Promise<Transaction> {
    const transaction = await this.getById(id);
    if (!transaction) {
      throw new TransactionNotFoundError();
    }
    return transaction;
  }

  private store(transaction: Transaction): Transaction {
    this._transactions.update((transactions) =>
      transactions.some((item) => item.id === transaction.id)
        ? transactions.map((item) => (item.id === transaction.id ? transaction : item))
        : [...transactions, transaction],
    );
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
