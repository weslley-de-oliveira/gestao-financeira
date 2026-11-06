import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiProblemError } from '../../core/interceptors/api-problem-error';
import { InvalidCreditCardInputError } from '../../features/credit-cards/domain/credit-card-input';
import { CreditCard } from '../../shared/models/credit-card';
import { CreditCardChanges, CreditCardRepository } from '../repositories/credit-card.repository';
import { NewRecord } from '../repositories/new-record';
import { API_BASE_URL } from './api.config';
import { ifMatch, nullWhenNotFound, pick, SessionUser, toDomainError } from './api-http';
import type { ApiCreditCard } from './api-types';

const FIELDS = [
  'name',
  'brand',
  'lastFourDigits',
  'creditLimit',
  'closingDay',
  'dueDay',
  'paymentAccountId',
  'color',
] as const;

/** Cartões de crédito na API real (`/v1/credit-cards`). */
@Injectable()
export class ApiCreditCardRepository extends CreditCardRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/credit-cards`;
  private readonly session = inject(SessionUser);

  /** O servidor devolve só os cartões da sessão; `userId` não é enviado. */
  listByUser(): Observable<CreditCard[]> {
    return this.http
      .get<ApiCreditCard[]>(this.url, { params: { includeArchived: true } })
      .pipe(map((list) => list.map((item) => this.toCard(item))));
  }

  findById(id: string): Observable<CreditCard | null> {
    return this.http.get<ApiCreditCard>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map((item) => this.toCard(item)),
      nullWhenNotFound(),
    );
  }

  create(card: NewRecord<CreditCard>): Observable<CreditCard> {
    return this.http.post<ApiCreditCard>(this.url, pick(card, FIELDS)).pipe(
      map((item) => this.toCard(item)),
      toDomainError(invalidPaymentAccount),
    );
  }

  update(id: string, changes: CreditCardChanges, version?: string): Observable<CreditCard> {
    return this.http
      .patch<ApiCreditCard>(
        `${this.url}/${encodeURIComponent(id)}`,
        pick(changes, [...FIELDS, 'isArchived']),
        ifMatch(version),
      )
      .pipe(
        map((item) => this.toCard(item)),
        toDomainError(invalidPaymentAccount),
      );
  }

  private toCard(item: ApiCreditCard): CreditCard {
    return {
      id: item.id,
      userId: this.session.id(),
      name: item.name,
      brand: item.brand,
      lastFourDigits: item.lastFourDigits,
      creditLimit: item.creditLimit,
      closingDay: item.closingDay,
      dueDay: item.dueDay,
      paymentAccountId: item.paymentAccountId,
      color: item.color,
      isArchived: item.isArchived,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      usage: {
        usedLimit: item.usedLimit,
        availableLimit: item.availableLimit,
        nextInvoice: item.nextInvoice,
      },
    };
  }
}

/** Conta de pagamento inexistente (422) ou arquivada (409): o formulário marca o campo. */
function invalidPaymentAccount(problem: ApiProblemError): Error | null {
  return problem.status === 409 || problem.field === 'paymentAccountId'
    ? new InvalidCreditCardInputError('paymentAccountId')
    : null;
}
