import { NewRecord, withIdentity } from '../app/data-access/repositories/new-record';
import { Injectable } from '@angular/core';
import { TransactionSource } from '../app/data-access/repositories/transaction-source';
import { Observable, map, of, throwError } from 'rxjs';
import {
  TransactionChanges,
  TransactionRepository,
} from '../app/data-access/repositories/transaction.repository';
import {
  pageTransactions,
  totalTransactions,
} from '../app/features/transactions/domain/transaction-query';
import { Transaction } from '../app/shared/models/transaction';
import {
  TransactionFilters,
  TransactionPage,
  TransactionPageRequest,
  TransactionTotals,
} from '../app/shared/models/transaction-query';

/** Repositório de transações em memória, para testes sem API. */
@Injectable()
export class InMemoryTransactionRepository
  extends TransactionRepository
  implements TransactionSource
{
  readonly records: Transaction[] = [];

  listByUser(userId: string): Observable<Transaction[]> {
    return of(this.records.filter((transaction) => transaction.userId === userId).map(clone));
  }

  query(userId: string, request: TransactionPageRequest): Observable<TransactionPage> {
    return this.listByUser(userId).pipe(map((all) => pageTransactions(all, request)));
  }

  summarize(userId: string, filters: TransactionFilters): Observable<TransactionTotals> {
    return this.listByUser(userId).pipe(map((all) => totalTransactions(all, filters)));
  }

  findById(id: string): Observable<Transaction | null> {
    const transaction = this.records.find((record) => record.id === id);
    return of(transaction ? clone(transaction) : null);
  }

  create(input: NewRecord<Transaction>): Observable<Transaction> {
    const transaction = withIdentity<Transaction>(input);
    this.records.push(clone(transaction));
    return of(clone(transaction));
  }

  update(id: string, changes: TransactionChanges): Observable<Transaction> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Transaction ${id} not found`));
    }
    this.records[index] = { ...this.records[index], ...changes };
    return of(clone(this.records[index]));
  }

  delete(id: string): Observable<void> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Transaction ${id} not found`));
    }
    this.records.splice(index, 1);
    return of(undefined);
  }
}

function clone(transaction: Transaction): Transaction {
  return { ...transaction };
}
