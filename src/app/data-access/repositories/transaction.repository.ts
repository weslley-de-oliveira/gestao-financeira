import { Observable } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';

export type TransactionChanges = Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>;

/** Contrato de acesso às transações. A implementação atual usa HTTP (JSON Server). */
export abstract class TransactionRepository {
  abstract listByUser(userId: string): Observable<Transaction[]>;

  /** Retorna `null` quando a transação não existe. */
  abstract findById(id: string): Observable<Transaction | null>;

  abstract create(transaction: Transaction): Observable<Transaction>;

  abstract update(id: string, changes: TransactionChanges): Observable<Transaction>;

  abstract delete(id: string): Observable<void>;
}
