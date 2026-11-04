import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Account } from '../../shared/models/account';
import { API_BASE_URL } from '../api/api.config';
import { AccountDto, toAccount, toAccountDto } from '../dto/account.dto';
import { AccountChanges, AccountRepository } from './account.repository';

@Injectable()
export class HttpAccountRepository extends AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/accounts`;

  listByUser(userId: string): Observable<Account[]> {
    return this.http
      .get<AccountDto[]>(this.url, { params: { userId } })
      .pipe(map((accounts) => accounts.map(toAccount)));
  }

  findById(id: string): Observable<Account | null> {
    return this.http.get<AccountDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(toAccount),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  create(account: Account): Observable<Account> {
    return this.http.post<AccountDto>(this.url, toAccountDto(account)).pipe(map(toAccount));
  }

  update(id: string, changes: AccountChanges): Observable<Account> {
    return this.http
      .patch<AccountDto>(`${this.url}/${encodeURIComponent(id)}`, changes)
      .pipe(map(toAccount));
  }
}
