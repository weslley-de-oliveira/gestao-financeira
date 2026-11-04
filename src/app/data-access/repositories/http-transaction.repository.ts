import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';
import { API_BASE_URL } from '../api/api.config';
import { TransactionDto, toTransaction, toTransactionDto } from '../dto/transaction.dto';
import { TransactionChanges, TransactionRepository } from './transaction.repository';

@Injectable()
export class HttpTransactionRepository extends TransactionRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/transactions`;

  listByUser(userId: string): Observable<Transaction[]> {
    return this.http
      .get<TransactionDto[]>(this.url, { params: { userId } })
      .pipe(map((transactions) => transactions.map(toTransaction)));
  }

  findById(id: string): Observable<Transaction | null> {
    return this.http.get<TransactionDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(toTransaction),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  create(transaction: Transaction): Observable<Transaction> {
    return this.http
      .post<TransactionDto>(this.url, toTransactionDto(transaction))
      .pipe(map(toTransaction));
  }

  update(id: string, changes: TransactionChanges): Observable<Transaction> {
    return this.http
      .patch<TransactionDto>(`${this.url}/${encodeURIComponent(id)}`, changes)
      .pipe(map(toTransaction));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }
}
