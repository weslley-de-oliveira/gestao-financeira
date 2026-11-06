import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';
import { NewRecord } from '../repositories/new-record';
import { TransactionChanges, TransactionRepository } from '../repositories/transaction.repository';
import { API_BASE_URL } from './api.config';
import { SessionUser, nullWhenNotFound, pick } from './api-http';
import type {
  ApiCreateEntry,
  ApiCreateTransfer,
  ApiInvoice,
  ApiTransaction,
  ApiTransactionPage,
} from './api-types';

/** Maior página aceita pela API. */
const PAGE_SIZE = 100;

/**
 * Transações na API real (`/v1/transactions`). O pagamento de fatura usa a rota da fatura, que
 * calcula o valor e a data no servidor.
 */
@Injectable()
export class ApiTransactionRepository extends TransactionRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/transactions`;
  private readonly session = inject(SessionUser);

  /**
   * Todas as transações da sessão, percorrendo as páginas do cursor: os filtros e os saldos do
   * app são calculados sobre a lista completa.
   */
  listByUser(): Observable<Transaction[]> {
    return this.page(null).pipe(
      expand((page) => (page.nextCursor ? this.page(page.nextCursor) : EMPTY)),
      reduce<ApiTransactionPage, Transaction[]>(
        (all, page) => [...all, ...page.items.map((item) => this.toTransaction(item))],
        [],
      ),
    );
  }

  findById(id: string): Observable<Transaction | null> {
    return this.http.get<ApiTransaction>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map((item) => this.toTransaction(item)),
      nullWhenNotFound(),
    );
  }

  create(transaction: NewRecord<Transaction>): Observable<Transaction> {
    return this.http
      .post<ApiTransaction>(this.url, toCreateBody(transaction))
      .pipe(map((item) => this.toTransaction(item)));
  }

  /**
   * A API não aceita `null` nos vínculos (conta, cartão, destino, categoria): o vínculo informado
   * substitui o anterior, e os que deixam de valer são limpos no servidor conforme o tipo.
   */
  update(id: string, changes: TransactionChanges): Observable<Transaction> {
    const body = pick(changes, [
      'type',
      'description',
      'amount',
      'date',
      'accountId',
      'creditCardId',
      'destinationAccountId',
      'categoryId',
      'status',
      'notes',
    ]);
    for (const key of [
      'accountId',
      'creditCardId',
      'destinationAccountId',
      'categoryId',
    ] as const) {
      if (body[key] === null) {
        delete body[key];
      }
    }
    return this.http
      .patch<ApiTransaction>(`${this.url}/${encodeURIComponent(id)}`, body)
      .pipe(map((item) => this.toTransaction(item)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }

  override payInvoice(payment: NewRecord<Transaction>): Observable<Transaction> {
    return this.http
      .post<ApiInvoice>(this.paymentUrl(payment), null)
      .pipe(map((invoice) => this.toTransaction(invoicePayment(invoice))));
  }

  override undoInvoicePayment(payment: Transaction): Observable<void> {
    return this.http.delete<ApiInvoice>(this.paymentUrl(payment)).pipe(map(() => undefined));
  }

  private paymentUrl({
    creditCardId,
    invoiceMonth,
  }: Pick<Transaction, 'creditCardId' | 'invoiceMonth'>): string {
    if (!creditCardId || !invoiceMonth) {
      throw new Error('Invoice payment without card or month');
    }
    return `${this.baseUrl}/credit-cards/${encodeURIComponent(creditCardId)}/invoices/${invoiceMonth}/payment`;
  }

  private page(cursor: string | null): Observable<ApiTransactionPage> {
    const params: Record<string, string | number> = { limit: PAGE_SIZE };
    if (cursor) {
      params['cursor'] = cursor;
    }
    return this.http.get<ApiTransactionPage>(this.url, { params });
  }

  private toTransaction(item: ApiTransaction): Transaction {
    return {
      id: item.id,
      userId: this.session.id(),
      type: item.type,
      description: item.description,
      amount: item.amount,
      date: item.date,
      accountId: item.accountId,
      creditCardId: item.creditCardId,
      invoiceMonth: item.invoiceMonth,
      destinationAccountId: item.destinationAccountId,
      categoryId: item.categoryId,
      status: item.status,
      notes: item.notes,
      createdAt: item.createdAt,
    };
  }
}

/** Corpo do `POST /transactions`: transferência ou lançamento em conta/cartão. */
function toCreateBody(transaction: NewRecord<Transaction>): ApiCreateEntry | ApiCreateTransfer {
  const { type, description, amount, date, status, notes } = transaction;
  if (type === 'transfer') {
    return {
      type,
      description,
      amount,
      date,
      status,
      notes,
      accountId: required(transaction.accountId),
      destinationAccountId: required(transaction.destinationAccountId),
    };
  }
  if (type === 'invoice-payment') {
    throw new Error('Invoice payments are created through payInvoice');
  }
  return {
    type,
    description,
    amount,
    date,
    status,
    notes,
    categoryId: required(transaction.categoryId),
    ...(transaction.creditCardId
      ? { creditCardId: transaction.creditCardId }
      : { accountId: required(transaction.accountId) }),
  };
}

function invoicePayment(invoice: ApiInvoice): ApiTransaction {
  if (!invoice.payment) {
    throw new Error('Invoice payment missing from the response');
  }
  return invoice.payment;
}

function required(id: string | null): string {
  if (!id) {
    throw new Error('Missing required link');
  }
  return id;
}
