import { Observable } from 'rxjs';
import { Goal } from '../../shared/models/goal';

export type GoalChanges = Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>;

/** Contrato de acesso às metas. A implementação atual usa HTTP (JSON Server). */
export abstract class GoalRepository {
  abstract listByUser(userId: string): Observable<Goal[]>;

  /** Retorna `null` quando a meta não existe. */
  abstract findById(id: string): Observable<Goal | null>;

  abstract create(goal: Goal): Observable<Goal>;

  abstract update(id: string, changes: GoalChanges): Observable<Goal>;
}
