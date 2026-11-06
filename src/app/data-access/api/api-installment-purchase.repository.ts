import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, retry, throwError, timer } from 'rxjs';
import {
  InstallmentPurchase,
  InstallmentPurchaseChanges,
  InstallmentPurchaseInput,
} from '../../features/installments/domain/installment-rules';
import { InstallmentPurchaseRepository } from '../repositories/installment-purchase.repository';
import { API_BASE_URL } from './api.config';
import { nullWhenNotFound, pick, SessionUser, toDomainError } from './api-http';
import {
  PAYMENT_RETRY_DELAY_MS,
  isTransient,
  toTransactionModel,
  transactionError,
} from './api-transaction.repository';
import type { ApiInstallmentPurchase } from './api-types';

/**
 * Compras parceladas na API (`/v1/installment-purchases`): o servidor divide o valor, calcula as
 * datas das parcelas e confere as faturas pagas.
 */
@Injectable()
export class ApiInstallmentPurchaseRepository extends InstallmentPurchaseRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/installment-purchases`;
  private readonly session = inject(SessionUser);

  /**
   * Uma `Idempotency-Key` por compra: se a resposta se perder, a nova tentativa usa a mesma chave
   * e a API devolve a compra já gravada, sem duplicar as parcelas.
   */
  create(_userId: string, input: InstallmentPurchaseInput): Observable<InstallmentPurchase> {
    const headers = { 'Idempotency-Key': crypto.randomUUID() };
    const body = pick(input, [
      'description',
      'amount',
      'date',
      'creditCardId',
      'categoryId',
      'installmentCount',
      'notes',
    ]);
    return this.http.post<ApiInstallmentPurchase>(this.url, body, { headers }).pipe(
      retry({
        count: 1,
        delay: (error: unknown) =>
          isTransient(error) ? timer(PAYMENT_RETRY_DELAY_MS) : throwError(() => error),
      }),
      map((item) => this.toPurchase(item)),
      toDomainError(transactionError),
    );
  }

  findById(_userId: string, id: string): Observable<InstallmentPurchase | null> {
    return this.http.get<ApiInstallmentPurchase>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map((item) => this.toPurchase(item)),
      nullWhenNotFound(),
    );
  }

  update(
    _userId: string,
    id: string,
    changes: InstallmentPurchaseChanges,
  ): Observable<InstallmentPurchase> {
    return this.http
      .patch<ApiInstallmentPurchase>(
        `${this.url}/${encodeURIComponent(id)}`,
        pick(changes, ['description', 'categoryId', 'notes']),
      )
      .pipe(
        map((item) => this.toPurchase(item)),
        toDomainError(transactionError),
      );
  }

  delete(_userId: string, id: string): Observable<void> {
    return this.http.delete<unknown>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(() => undefined),
      toDomainError(transactionError),
    );
  }

  private toPurchase({ installments, ...purchase }: ApiInstallmentPurchase): InstallmentPurchase {
    const userId = this.session.id();
    return {
      ...purchase,
      userId,
      installments: installments.map((item) => toTransactionModel(item, userId)),
    };
  }
}
