import { NewRecord, withIdentity } from '../app/data-access/repositories/new-record';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { GoalChanges, GoalRepository } from '../app/data-access/repositories/goal.repository';
import { Goal } from '../app/shared/models/goal';

/** Repositório de metas em memória, para testes sem JSON Server. */
@Injectable()
export class InMemoryGoalRepository extends GoalRepository {
  readonly records: Goal[] = [];

  listByUser(userId: string): Observable<Goal[]> {
    return of(this.records.filter((goal) => goal.userId === userId).map(clone));
  }

  findById(id: string): Observable<Goal | null> {
    const goal = this.records.find((record) => record.id === id);
    return of(goal ? clone(goal) : null);
  }

  create(input: NewRecord<Goal>): Observable<Goal> {
    const goal = withIdentity<Goal>(input);
    this.records.push(clone(goal));
    return of(clone(goal));
  }

  update(id: string, changes: GoalChanges): Observable<Goal> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Goal ${id} not found`));
    }
    this.records[index] = clone({ ...this.records[index], ...changes });
    return of(clone(this.records[index]));
  }
}

function clone(goal: Goal): Goal {
  return { ...goal, contributions: goal.contributions.map((item) => ({ ...item })) };
}
