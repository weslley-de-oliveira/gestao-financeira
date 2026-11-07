import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, retry, throwError, timer } from 'rxjs';
import { ApiProblemError } from '../../core/interceptors/api-problem-error';
import { PaidInvoiceError } from '../../features/invoices/domain/invoice-rules';
import {
  InvalidRefundInputError,
  NotRefundableError,
  RefundInput,
} from '../../features/refunds/domain/refund-rules';
import { Transaction } from '../../shared/models/transaction';
import { RefundRepository } from '../repositories/refund.repository';
import { API_BASE_URL } from './api.config';
import { SessionUser, pick, toDomainError } from './api-http';
import {
  PAID_INVOICE_PROBLEM,
  PAYMENT_RETRY_DELAY_MS,
  isTransient,
  toTransactionModel,
} from './api-transaction.repository';
import type { ApiTransaction } from './api-types';

const REFUND_FIELDS = ['description', 'amount', 'date', 'notes'] as const;

/**
 * Estornos na API (`/v1/transactions/:id/refunds`): o servidor confere o que falta estornar, a
 * data e, no cartão, a fatura paga.
 */
@Injectable()
export class ApiRefundRepository extends RefundRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/transactions`;
  private readonly session = inject(SessionUser);

  /**
   * Uma `Idempotency-Key` por estorno: se a resposta se perder, a nova tentativa usa a mesma chave
   * e a API devolve o estorno já gravado, sem estornar duas vezes.
   */
  create(_userId: string, expense: Transaction, input: RefundInput): Observable<Transaction> {
    const headers = { 'Idempotency-Key': crypto.randomUUID() };
    return this.http
      .post<ApiTransaction>(this.refundsUrl(expense.id), pick(input, REFUND_FIELDS), { headers })
      .pipe(
        retry({
          count: 1,
          delay: (error: unknown) =>
            isTransient(error) ? timer(PAYMENT_RETRY_DELAY_MS) : throwError(() => error),
        }),
        map((item) => toTransactionModel(item, this.session.id())),
        toDomainError(refundError),
      );
  }

  listByExpense(_userId: string, expenseId: string): Observable<Transaction[]> {
    return this.http
      .get<ApiTransaction[]>(this.refundsUrl(expenseId))
      .pipe(map((items) => items.map((item) => toTransactionModel(item, this.session.id()))));
  }

  private refundsUrl(expenseId: string): string {
    return `${this.url}/${encodeURIComponent(expenseId)}/refunds`;
  }
}

/**
 * Estorno recusado: na fatura já paga (`PaidInvoiceError`), de uma transação que não é despesa
 * realizada (`NotRefundableError`) ou com um campo inválido (valor acima do que falta estornar,
 * data anterior à despesa).
 */
export function refundError(problem: ApiProblemError): Error | null {
  if (problem.status === 409) {
    return problem.type === PAID_INVOICE_PROBLEM
      ? new PaidInvoiceError()
      : new NotRefundableError();
  }
  const field = REFUND_FIELDS.find((item) => item === problem.field);
  return problem.status === 422 && field ? new InvalidRefundInputError(field) : null;
}
