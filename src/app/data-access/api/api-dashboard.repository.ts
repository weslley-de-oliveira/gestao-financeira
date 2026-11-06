import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BudgetProgress } from '../../shared/models/budget';
import { DashboardData } from '../../shared/models/dashboard';
import { GoalWithProgress } from '../../shared/models/goal';
import { DateRange } from '../../shared/models/period';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { API_BASE_URL } from './api.config';
import { toBudgetModel } from './api-budget.repository';
import { toGoalModel } from './api-goal.repository';
import { toTransactionModel } from './api-transaction.repository';
import type { ApiBudget, ApiDashboard, ApiGoal } from './api-types';

/** Dashboard calculado pela API (`GET /v1/dashboard`): uma chamada, sem baixar as transações. */
@Injectable()
export class ApiDashboardRepository extends DashboardRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/dashboard`;

  load(userId: string, { start, end }: DateRange): Observable<DashboardData> {
    return this.http
      .get<ApiDashboard>(this.url, { params: { from: start, to: end } })
      .pipe(map((dashboard) => toDashboard(dashboard, userId)));
  }
}

function toDashboard(dashboard: ApiDashboard, userId: string): DashboardData {
  return {
    summary: dashboard.summary,
    balance: dashboard.balance,
    incomeVsExpense: dashboard.incomeVsExpense.map(({ label, income, expense }) => ({
      label,
      income,
      expense,
    })),
    balanceEvolution: dashboard.balanceEvolution,
    recentTransactions: dashboard.recentTransactions.map((item) =>
      toTransactionModel(item, userId),
    ),
    budgetHighlights: dashboard.budgetHighlights.flatMap((item) => {
      const progress = toBudgetProgress(item, userId);
      return progress ? [progress] : [];
    }),
    goalHighlights: dashboard.goalHighlights.map((item) => toGoalWithProgress(item, userId)),
  };
}

/** Orçamento com o consumo do mês; a API manda o consumo junto do orçamento. */
function toBudgetProgress(item: ApiBudget, userId: string): BudgetProgress | null {
  if (!item.progress) {
    return null;
  }
  const { month, limit, spent, pending, available, percent, state } = item.progress;
  return {
    budget: toBudgetModel(item, userId),
    month,
    limit,
    spent,
    pending,
    available,
    percent,
    state,
  };
}

function toGoalWithProgress(item: ApiGoal, userId: string): GoalWithProgress {
  return {
    ...toGoalModel(item, userId),
    currentAmount: item.currentAmount,
    remainingAmount: item.remainingAmount,
    excessAmount: item.excessAmount,
    percent: item.percent,
    status: item.status,
    monthsLeft: item.monthsLeft,
    monthlyPace: item.monthlyPace,
  };
}
