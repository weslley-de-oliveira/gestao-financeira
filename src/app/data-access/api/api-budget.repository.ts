import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Budget } from '../../shared/models/budget';
import { BudgetChanges, BudgetRepository } from '../repositories/budget.repository';
import { NewRecord } from '../repositories/new-record';
import { API_BASE_URL } from './api.config';
import { SessionUser, nullWhenNotFound } from './api-http';
import type { ApiBudget } from './api-types';

/**
 * Orçamentos na API real (`/v1/budgets`). A API recebe só o limite atual (`limitAmount`) e cria a
 * vigência do mês corrente no servidor; o app continua lendo o histórico em `limits`.
 */
@Injectable()
export class ApiBudgetRepository extends BudgetRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/budgets`;
  private readonly session = inject(SessionUser);

  /** O servidor devolve só os orçamentos da sessão; `userId` não é enviado. */
  listByUser(): Observable<Budget[]> {
    return this.http
      .get<ApiBudget[]>(this.url)
      .pipe(map((list) => list.map((item) => this.toBudget(item))));
  }

  findById(id: string): Observable<Budget | null> {
    return this.http.get<ApiBudget>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map((item) => this.toBudget(item)),
      nullWhenNotFound(),
    );
  }

  create(budget: NewRecord<Budget>): Observable<Budget> {
    return this.http
      .post<ApiBudget>(this.url, {
        categoryId: budget.categoryId,
        limitAmount: currentLimit(budget.limits),
        alertThreshold: budget.alertThreshold,
      })
      .pipe(map((item) => this.toBudget(item)));
  }

  update(id: string, changes: BudgetChanges): Observable<Budget> {
    const body: { limitAmount?: number; alertThreshold?: number } = {};
    if (changes.limits) {
      body.limitAmount = currentLimit(changes.limits);
    }
    if (changes.alertThreshold !== undefined) {
      body.alertThreshold = changes.alertThreshold;
    }
    return this.http
      .patch<ApiBudget>(`${this.url}/${encodeURIComponent(id)}`, body)
      .pipe(map((item) => this.toBudget(item)));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  private toBudget(item: ApiBudget): Budget {
    return {
      id: item.id,
      userId: this.session.id(),
      categoryId: item.categoryId,
      limits: item.limits.map(({ month, amount }) => ({ month, amount })),
      alertThreshold: item.alertThreshold,
      createdAt: item.createdAt,
    };
  }
}

/** O limite em vigor é o da vigência mais recente (as vigências vêm em ordem crescente). */
function currentLimit(limits: Budget['limits']): number {
  return limits[limits.length - 1].amount;
}
