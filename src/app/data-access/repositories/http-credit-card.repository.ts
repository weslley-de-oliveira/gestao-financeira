import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { CreditCard } from '../../shared/models/credit-card';
import { API_BASE_URL } from '../api/api.config';
import { CreditCardDto, toCreditCard, toCreditCardDto } from '../dto/credit-card.dto';
import { CreditCardChanges, CreditCardRepository } from './credit-card.repository';

@Injectable()
export class HttpCreditCardRepository extends CreditCardRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/creditCards`;

  listByUser(userId: string): Observable<CreditCard[]> {
    return this.http
      .get<CreditCardDto[]>(this.url, { params: { userId } })
      .pipe(map((cards) => cards.map(toCreditCard)));
  }

  findById(id: string): Observable<CreditCard | null> {
    return this.http.get<CreditCardDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(toCreditCard),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  create(card: CreditCard): Observable<CreditCard> {
    return this.http.post<CreditCardDto>(this.url, toCreditCardDto(card)).pipe(map(toCreditCard));
  }

  update(id: string, changes: CreditCardChanges): Observable<CreditCard> {
    return this.http
      .patch<CreditCardDto>(`${this.url}/${encodeURIComponent(id)}`, changes)
      .pipe(map(toCreditCard));
  }
}
