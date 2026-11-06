import { NewRecord, withIdentity } from '../repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Budget } from '../../shared/models/budget';
import { toBudget, toBudgetDto } from '../dto/budget.dto';
import { BudgetChanges, BudgetRepository } from '../repositories/budget.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/** Orçamentos da demonstração, no `localStorage`. */
@Injectable()
export class LocalBudgetRepository extends BudgetRepository {
  private readonly budgets = new LocalCollection(inject(LocalDatabase), 'budgets');

  listByUser(userId: string): Observable<Budget[]> {
    return this.budgets.listByUser(userId).pipe(map((records) => records.map(toBudget)));
  }

  findById(id: string): Observable<Budget | null> {
    return this.budgets.findById(id).pipe(map((dto) => (dto ? toBudget(dto) : null)));
  }

  create(input: NewRecord<Budget>): Observable<Budget> {
    const budget = withIdentity<Budget>(input);
    return this.budgets.insert(toBudgetDto(budget)).pipe(map(toBudget));
  }

  update(id: string, changes: BudgetChanges): Observable<Budget> {
    return this.budgets.patch(id, changes).pipe(map(toBudget));
  }

  delete(id: string): Observable<void> {
    return this.budgets.remove(id);
  }
}
