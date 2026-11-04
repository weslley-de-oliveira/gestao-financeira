import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BudgetChanges, BudgetRepository } from '../app/data-access/repositories/budget.repository';
import { Budget } from '../app/shared/models/budget';

/** Repositório de orçamentos em memória, para testes sem JSON Server. */
@Injectable()
export class InMemoryBudgetRepository extends BudgetRepository {
  readonly records: Budget[] = [];

  listByUser(userId: string): Observable<Budget[]> {
    return of(this.records.filter((budget) => budget.userId === userId).map(clone));
  }

  findById(id: string): Observable<Budget | null> {
    const budget = this.records.find((record) => record.id === id);
    return of(budget ? clone(budget) : null);
  }

  create(budget: Budget): Observable<Budget> {
    this.records.push(clone(budget));
    return of(clone(budget));
  }

  update(id: string, changes: BudgetChanges): Observable<Budget> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Budget ${id} not found`));
    }
    this.records[index] = clone({ ...this.records[index], ...changes });
    return of(clone(this.records[index]));
  }

  delete(id: string): Observable<void> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Budget ${id} not found`));
    }
    this.records.splice(index, 1);
    return of(undefined);
  }
}

function clone(budget: Budget): Budget {
  return { ...budget, limits: budget.limits.map((limit) => ({ ...limit })) };
}
