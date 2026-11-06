import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Account } from '../../shared/models/account';
import { AccountChanges, AccountRepository } from '../repositories/account.repository';
import { NewRecord } from '../repositories/new-record';
import { API_BASE_URL } from './api.config';
import { ifMatch, nullWhenNotFound, pick, SessionUser } from './api-http';
import type { ApiAccount } from './api-types';

const FIELDS = ['name', 'type', 'institution', 'initialBalance', 'color', 'icon'] as const;

/** Contas na API real (`/v1/accounts`). */
@Injectable()
export class ApiAccountRepository extends AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/accounts`;
  private readonly session = inject(SessionUser);

  /** O servidor devolve só as contas da sessão; `userId` não é enviado. */
  listByUser(): Observable<Account[]> {
    return this.http
      .get<ApiAccount[]>(this.url, { params: { includeArchived: true } })
      .pipe(map((list) => list.map((item) => this.toAccount(item))));
  }

  findById(id: string): Observable<Account | null> {
    return this.http.get<ApiAccount>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map((item) => this.toAccount(item)),
      nullWhenNotFound(),
    );
  }

  create(account: NewRecord<Account>): Observable<Account> {
    return this.http
      .post<ApiAccount>(this.url, pick(account, FIELDS))
      .pipe(map((item) => this.toAccount(item)));
  }

  update(id: string, changes: AccountChanges, version?: string): Observable<Account> {
    return this.http
      .patch<ApiAccount>(
        `${this.url}/${encodeURIComponent(id)}`,
        pick(changes, [...FIELDS, 'isArchived']),
        ifMatch(version),
      )
      .pipe(map((item) => this.toAccount(item)));
  }

  private toAccount(item: ApiAccount): Account {
    return {
      id: item.id,
      userId: this.session.id(),
      name: item.name,
      type: item.type,
      institution: item.institution,
      initialBalance: item.initialBalance,
      color: item.color,
      icon: item.icon,
      isArchived: item.isArchived,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      currentBalance: item.currentBalance,
    };
  }
}
