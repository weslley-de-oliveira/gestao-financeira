import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Account } from '../../shared/models/account';
import { toAccount, toAccountDto } from '../dto/account.dto';
import { AccountChanges, AccountRepository } from '../repositories/account.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/** Contas da demonstração, no `localStorage`. */
@Injectable()
export class LocalAccountRepository extends AccountRepository {
  private readonly accounts = new LocalCollection(inject(LocalDatabase), 'accounts');

  listByUser(userId: string): Observable<Account[]> {
    return this.accounts.listByUser(userId).pipe(map((records) => records.map(toAccount)));
  }

  findById(id: string): Observable<Account | null> {
    return this.accounts.findById(id).pipe(map((dto) => (dto ? toAccount(dto) : null)));
  }

  create(account: Account): Observable<Account> {
    return this.accounts.insert(toAccountDto(account)).pipe(map(toAccount));
  }

  update(id: string, changes: AccountChanges): Observable<Account> {
    return this.accounts.patch(id, changes).pipe(map(toAccount));
  }
}
