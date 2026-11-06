import { Observable } from 'rxjs';
import { Goal, GoalContribution } from '../../shared/models/goal';
import { NewRecord, withIdentity } from './new-record';

export type GoalChanges = Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>;

/** Contrato de acesso às metas: na API (`data-access/api`) ou no `localStorage` (demo). */
export abstract class GoalRepository {
  abstract listByUser(userId: string): Observable<Goal[]>;

  /** Retorna `null` quando a meta não existe. */
  abstract findById(id: string): Observable<Goal | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(goal: NewRecord<Goal>): Observable<Goal>;

  abstract update(id: string, changes: GoalChanges): Observable<Goal>;

  /**
   * Registra um aporte ou uma retirada. Por padrão, regrava a lista de movimentações da meta; a
   * API tem uma operação própria, que confere o acumulado no servidor.
   */
  addContribution(goal: Goal, contribution: NewRecord<GoalContribution>): Observable<Goal> {
    return this.update(goal.id, {
      contributions: [...goal.contributions, withIdentity<GoalContribution>(contribution)],
    });
  }

  /** Exclui um aporte ou uma retirada. Por padrão, regrava a lista sem a movimentação. */
  removeContribution(goal: Goal, contributionId: string): Observable<Goal> {
    return this.update(goal.id, {
      contributions: goal.contributions.filter((item) => item.id !== contributionId),
    });
  }
}
