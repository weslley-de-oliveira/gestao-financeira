import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';
import { toTransaction, toTransactionDto } from '../dto/transaction.dto';
import { TransactionChanges, TransactionRepository } from '../repositories/transaction.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/** Transações da demonstração, no `localStorage`. */
@Injectable()
export class LocalTransactionRepository extends TransactionRepository {
  private readonly transactions = new LocalCollection(inject(LocalDatabase), 'transactions');

  listByUser(userId: string): Observable<Transaction[]> {
    return this.transactions.listByUser(userId).pipe(map((records) => records.map(toTransaction)));
  }

  findById(id: string): Observable<Transaction | null> {
    return this.transactions.findById(id).pipe(map((dto) => (dto ? toTransaction(dto) : null)));
  }

  create(transaction: Transaction): Observable<Transaction> {
    return this.transactions.insert(toTransactionDto(transaction)).pipe(map(toTransaction));
  }

  update(id: string, changes: TransactionChanges): Observable<Transaction> {
    return this.transactions.patch(id, changes).pipe(map(toTransaction));
  }

  delete(id: string): Observable<void> {
    return this.transactions.remove(id);
  }
}
