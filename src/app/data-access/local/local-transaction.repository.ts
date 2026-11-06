import { NewRecord, withIdentity } from '../repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  pageTransactions,
  totalTransactions,
} from '../../features/transactions/domain/transaction-query';
import { Transaction } from '../../shared/models/transaction';
import {
  TransactionFilters,
  TransactionPage,
  TransactionPageRequest,
  TransactionTotals,
} from '../../shared/models/transaction-query';
import { toTransaction, toTransactionDto } from '../dto/transaction.dto';
import { TransactionSource } from '../repositories/transaction-source';
import { TransactionChanges, TransactionRepository } from '../repositories/transaction.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/**
 * Transações da demonstração, no `localStorage`. Consultas e totais são calculados sobre a lista
 * completa, com as mesmas regras da API.
 */
@Injectable()
export class LocalTransactionRepository extends TransactionRepository implements TransactionSource {
  private readonly transactions = new LocalCollection(inject(LocalDatabase), 'transactions');

  listByUser(userId: string): Observable<Transaction[]> {
    return this.transactions.listByUser(userId).pipe(map((records) => records.map(toTransaction)));
  }

  query(userId: string, request: TransactionPageRequest): Observable<TransactionPage> {
    return this.listByUser(userId).pipe(map((all) => pageTransactions(all, request)));
  }

  summarize(userId: string, filters: TransactionFilters): Observable<TransactionTotals> {
    return this.listByUser(userId).pipe(map((all) => totalTransactions(all, filters)));
  }

  findById(id: string): Observable<Transaction | null> {
    return this.transactions.findById(id).pipe(map((dto) => (dto ? toTransaction(dto) : null)));
  }

  create(input: NewRecord<Transaction>): Observable<Transaction> {
    const transaction = withIdentity<Transaction>(input);
    return this.transactions.insert(toTransactionDto(transaction)).pipe(map(toTransaction));
  }

  update(id: string, changes: TransactionChanges): Observable<Transaction> {
    return this.transactions.patch(id, changes).pipe(map(toTransaction));
  }

  delete(id: string): Observable<void> {
    return this.transactions.remove(id);
  }
}
