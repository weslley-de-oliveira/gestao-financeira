import { NewRecord, withIdentity } from '../repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Goal } from '../../shared/models/goal';
import { toGoal, toGoalDto } from './dto/goal.dto';
import { GoalChanges, GoalRepository } from '../repositories/goal.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/** Metas da demonstração, no `localStorage`. */
@Injectable()
export class LocalGoalRepository extends GoalRepository {
  private readonly goals = new LocalCollection(inject(LocalDatabase), 'goals');

  listByUser(userId: string): Observable<Goal[]> {
    return this.goals.listByUser(userId).pipe(map((records) => records.map(toGoal)));
  }

  findById(id: string): Observable<Goal | null> {
    return this.goals.findById(id).pipe(map((dto) => (dto ? toGoal(dto) : null)));
  }

  create(input: NewRecord<Goal>): Observable<Goal> {
    const goal = withIdentity<Goal>(input);
    return this.goals.insert(toGoalDto(goal)).pipe(map(toGoal));
  }

  update(id: string, changes: GoalChanges): Observable<Goal> {
    return this.goals.patch(id, changes).pipe(map(toGoal));
  }
}
