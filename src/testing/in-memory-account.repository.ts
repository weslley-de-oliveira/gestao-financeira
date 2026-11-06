import { NewRecord, withIdentity } from '../app/data-access/repositories/new-record';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  AccountChanges,
  AccountRepository,
} from '../app/data-access/repositories/account.repository';
import { Account } from '../app/shared/models/account';

/** Repositório de contas em memória, para testes sem API. */
@Injectable()
export class InMemoryAccountRepository extends AccountRepository {
  readonly records: Account[] = [];

  listByUser(userId: string): Observable<Account[]> {
    return of(this.records.filter((account) => account.userId === userId).map(clone));
  }

  findById(id: string): Observable<Account | null> {
    const account = this.records.find((record) => record.id === id);
    return of(account ? clone(account) : null);
  }

  create(input: NewRecord<Account>): Observable<Account> {
    const account = withIdentity<Account>(input);
    this.records.push(clone(account));
    return of(clone(account));
  }

  update(id: string, changes: AccountChanges): Observable<Account> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Account ${id} not found`));
    }
    this.records[index] = { ...this.records[index], ...changes };
    return of(clone(this.records[index]));
  }
}

function clone(account: Account): Account {
  return { ...account };
}
