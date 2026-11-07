import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RefundInput } from '../../features/refunds/domain/refund-rules';
import { Transaction } from '../../shared/models/transaction';
import { RefundRepository } from '../repositories/refund.repository';
import { TransactionSource } from '../repositories/transaction-source';
import { TransactionRepository } from '../repositories/transaction.repository';

/**
 * Estornos no navegador (demo e testes): gravados como transações `refund` pelo repositório de
 * transações, na conta ou no cartão da despesa e sem categoria própria (contam na dela).
 */
@Injectable()
export class LocalRefundRepository extends RefundRepository {
  private readonly transactions = inject(TransactionRepository);
  private readonly source = inject(TransactionSource);

  create(userId: string, expense: Transaction, input: RefundInput): Observable<Transaction> {
    return this.transactions.create({
      userId,
      type: 'refund',
      description: input.description,
      amount: input.amount,
      date: input.date,
      accountId: expense.accountId,
      creditCardId: expense.creditCardId,
      invoiceMonth: null,
      destinationAccountId: null,
      categoryId: null,
      status: 'completed',
      notes: input.notes,
      refundedTransactionId: expense.id,
    });
  }

  listByExpense(userId: string, expenseId: string): Observable<Transaction[]> {
    return this.source
      .listByUser(userId)
      .pipe(
        map((all) =>
          all
            .filter((transaction) => transaction.refundedTransactionId === expenseId)
            .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
        ),
      );
  }
}
