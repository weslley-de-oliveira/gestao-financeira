import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce, retry, throwError, timer } from 'rxjs';
import { InvoicePaymentError } from '../../features/invoices/domain/invoice-rules';
import {
  InvalidTransactionInputError,
  TransactionInput,
} from '../../features/transactions/domain/transaction-rules';
import { Transaction } from '../../shared/models/transaction';
import { NewRecord } from '../repositories/new-record';
import { TransactionChanges, TransactionRepository } from '../repositories/transaction.repository';
import { API_BASE_URL } from './api.config';
import { ifMatch, nullWhenNotFound, pick, SessionUser, toDomainError } from './api-http';
import { ApiProblemError } from '../../core/interceptors/api-problem-error';
import type {
  ApiCreateEntry,
  ApiCreateTransfer,
  ApiInvoice,
  ApiTransaction,
  ApiTransactionPage,
} from './api-types';

/** Espera antes de repetir um pagamento cuja resposta se perdeu (rede ou API acordando). */
export const PAYMENT_RETRY_DELAY_MS = 1000;

/** Maior página aceita pela API. */
const PAGE_SIZE = 100;

/** Vínculos com conta, cartão e categoria: o servidor confere se existem e estão ativos. */
const LINKS = ['accountId', 'creditCardId', 'destinationAccountId', 'categoryId'] as const;

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
    return this.http.post<ApiTransaction>(this.url, toCreateBody(transaction)).pipe(
      map((item) => this.toTransaction(item)),
      toDomainError(invalidLink),
    );
  }

  /**
   * A API não aceita `null` nos vínculos (conta, cartão, destino, categoria): o vínculo informado
   * substitui o anterior, e os que deixam de valer são limpos no servidor conforme o tipo.
   */
  update(id: string, changes: TransactionChanges, version?: string): Observable<Transaction> {
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
    for (const key of LINKS) {
      if (body[key] === null) {
        delete body[key];
      }
    }
    return this.http
      .patch<ApiTransaction>(`${this.url}/${encodeURIComponent(id)}`, body, ifMatch(version))
      .pipe(
        map((item) => this.toTransaction(item)),
        toDomainError(invalidLink),
      );
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }

  /**
   * Uma `Idempotency-Key` por pagamento: se a resposta se perder (rede, proxy), a nova tentativa
   * usa a mesma chave, e a API devolve o pagamento já feito em vez de pagar de novo.
   */
  override payInvoice(payment: NewRecord<Transaction>): Observable<Transaction> {
    const headers = { 'Idempotency-Key': crypto.randomUUID() };
    return this.http.post<ApiInvoice>(this.paymentUrl(payment), null, { headers }).pipe(
      retry({
        count: 1,
        delay: (error: unknown) =>
          isTransient(error) ? timer(PAYMENT_RETRY_DELAY_MS) : throwError(() => error),
      }),
      map((invoice) => this.toTransaction(invoicePayment(invoice))),
      toDomainError(notPayable),
    );
  }

  override undoInvoicePayment(payment: Transaction): Observable<void> {
    return this.http.delete<ApiInvoice>(this.paymentUrl(payment)).pipe(
      map(() => undefined),
      toDomainError(notPayable),
    );
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
    return toTransactionModel(item, this.session.id());
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

/** Vínculo recusado (inexistente, arquivado ou incompatível): o formulário marca o campo. */
function invalidLink(problem: ApiProblemError): Error | null {
  const field = LINKS.find((link) => link === problem.field);
  return problem.status === 422 && field
    ? new InvalidTransactionInputError(field satisfies keyof TransactionInput)
    : null;
}

/** Fatura que mudou de situação desde que a tela carregou (já paga, sem compras, aberta). */
function notPayable(problem: ApiProblemError): Error | null {
  return problem.status === 409 ? new InvoicePaymentError('not-payable') : null;
}

/** Falha em que a requisição pode ter chegado à API sem a resposta chegar ao navegador. */
function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status);
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

/** Converte o formato da API no modelo do app; o dono é o usuário da sessão. */
export function toTransactionModel(item: ApiTransaction, userId: string): Transaction {
  return {
    id: item.id,
    userId,
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
    updatedAt: item.updatedAt,
  };
}
