import { NewRecord, withIdentity } from '../app/data-access/repositories/new-record';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  TransactionChanges,
  TransactionRepository,
} from '../app/data-access/repositories/transaction.repository';
import { Transaction } from '../app/shared/models/transaction';

/** Repositório de transações em memória, para testes sem JSON Server. */
@Injectable()
export class InMemoryTransactionRepository extends TransactionRepository {
  readonly records: Transaction[] = [];

  listByUser(userId: string): Observable<Transaction[]> {
    return of(this.records.filter((transaction) => transaction.userId === userId).map(clone));
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
