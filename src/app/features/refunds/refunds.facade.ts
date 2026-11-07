import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { RefundRepository } from '../../data-access/repositories/refund.repository';
import { TransactionSource } from '../../data-access/repositories/transaction-source';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { Transaction, isRefund } from '../../shared/models/transaction';
import { PaidInvoiceError, isInvoicePaidFor } from '../invoices/domain/invoice-rules';
import {
  NotRefundableError,
  RefundInput,
  canRefund,
  normalizeRefundInput,
  remainingToRefund,
} from './domain/refund-rules';

/**
 * Casos de uso dos estornos de despesas. O valor e a data são conferidos aqui, nas duas
 * implementações, com os estornos que a despesa já tem; a fatura paga é conferida pela API (409 →
 * `PaidInvoiceError`) ou, na demo e nos testes, por esta facade. A exclusão de um estorno é a de
 * qualquer transação (`TransactionsFacade.delete`).
 */
@Injectable({ providedIn: 'root' })
export class RefundsFacade {
  private readonly repository = inject(RefundRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly auth = inject(AuthService);
  /** Lista completa, só na demonstração e nos testes, para conferir a fatura paga. */
  private readonly source = inject(TransactionSource, { optional: true });

  /** Estornos da despesa, dos mais antigos aos mais recentes. */
  async listFor(expenseId: string): Promise<Transaction[]> {
    return firstValueFrom(this.repository.listByExpense(this.userId(), expenseId));
  }

  /** Estorna a despesa realizada, até o valor que falta estornar e não antes da data dela. */
  async create(expense: Transaction, input: RefundInput): Promise<Transaction> {
    if (!canRefund(expense)) {
      throw new NotRefundableError();
    }
    const refunds = await this.listFor(expense.id);
    const normalized = normalizeRefundInput(input, expense, remainingToRefund(expense, refunds));
    await this.assertInvoicesOpen(expense.creditCardId, [normalized.date]);
    return firstValueFrom(this.repository.create(this.userId(), expense, normalized));
  }

  /**
   * Descrição, valor, data e observações de um estorno; a conta ou o cartão continuam os da
   * despesa. No cartão, nem a fatura atual nem a nova podem estar pagas.
   */
  async update(refund: Transaction, input: RefundInput): Promise<Transaction> {
    const expense =
      isRefund(refund) && refund.refundedTransactionId
        ? await firstValueFrom(this.transactions.findById(refund.refundedTransactionId))
        : null;
    if (!expense || expense.userId !== this.userId()) {
      throw new NotRefundableError();
    }
    const refunds = await this.listFor(expense.id);
    const normalized = normalizeRefundInput(
      input,
      expense,
      remainingToRefund(expense, refunds, refund.id),
    );
    await this.assertInvoicesOpen(refund.creditCardId, [refund.date, normalized.date]);
    return firstValueFrom(this.transactions.update(refund.id, normalized, refund.updatedAt));
  }

  private async assertInvoicesOpen(
    creditCardId: string | null,
    dates: readonly string[],
  ): Promise<void> {
    if (!creditCardId || !this.source) {
      return;
    }
    const userId = this.userId();
    const [card, transactions] = await Promise.all([
      firstValueFrom(this.creditCards.findById(creditCardId)),
      firstValueFrom(this.source.listByUser(userId)),
    ]);
    if (card && dates.some((date) => isInvoicePaidFor(card, transactions, date))) {
      throw new PaidInvoiceError();
    }
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
