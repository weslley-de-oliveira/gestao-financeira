import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { Invoice, InvoiceSummary } from '../../features/invoices/domain/invoice-rules';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { API_BASE_URL } from './api.config';
import { nullWhenNotFound, SessionUser } from './api-http';
import { toTransactionModel } from './api-transaction.repository';
import type { ApiInvoice, ApiInvoiceSummary } from './api-types';

/** Faturas calculadas pela API (`/v1/credit-cards/:id/invoices`). */
@Injectable()
export class ApiInvoiceRepository extends InvoiceRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(SessionUser);

  listByCard(_userId: string, creditCardId: string): Observable<InvoiceSummary[]> {
    return this.http.get<ApiInvoiceSummary[]>(this.invoicesUrl(creditCardId)).pipe(
      map((list) =>
        list.map(({ payment, ...invoice }) => ({
          ...invoice,
          payment: payment && this.toTransaction(payment),
        })),
      ),
      nullWhenNotFound(),
      map((list) => list ?? []),
    );
  }

  findByMonth(
    _userId: string,
    creditCardId: string,
    referenceMonth: string,
  ): Observable<Invoice | null> {
    if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
      return of(null);
    }
    return this.http.get<ApiInvoice>(`${this.invoicesUrl(creditCardId)}/${referenceMonth}`).pipe(
      map(({ payment, purchases, refunds, ...invoice }) => ({
        ...invoice,
        payment: payment && this.toTransaction(payment),
        purchases: purchases.map((purchase) => this.toTransaction(purchase)),
        refunds: refunds.map((refund) => this.toTransaction(refund)),
      })),
      nullWhenNotFound(),
    );
  }

  private invoicesUrl(creditCardId: string): string {
    return `${this.baseUrl}/credit-cards/${encodeURIComponent(creditCardId)}/invoices`;
  }

  private toTransaction(item: Parameters<typeof toTransactionModel>[0]) {
    return toTransactionModel(item, this.session.id());
  }
}
