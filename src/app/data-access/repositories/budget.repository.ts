import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { Budget } from '../../shared/models/budget';

export type BudgetChanges = Partial<Pick<Budget, 'limits' | 'alertThreshold'>>;

/** Contrato de acesso aos orçamentos. A implementação atual usa HTTP (JSON Server). */
export abstract class BudgetRepository {
  abstract listByUser(userId: string): Observable<Budget[]>;

  /** Retorna `null` quando o orçamento não existe. */
  abstract findById(id: string): Observable<Budget | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(budget: NewRecord<Budget>): Observable<Budget>;

  abstract update(id: string, changes: BudgetChanges): Observable<Budget>;

  abstract delete(id: string): Observable<void>;
}
