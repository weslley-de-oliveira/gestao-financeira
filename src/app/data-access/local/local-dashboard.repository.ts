import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { TODAY } from '../../core/services/today';
import { calculateBalance } from '../../features/accounts/domain/account-balance';
import { budgetProgress } from '../../features/budgets/domain/budget-rules';
import {
  balanceEvolution,
  incomeVsExpense,
  recentTransactions,
} from '../../features/dashboard/domain/dashboard-metrics';
import { queryGoals } from '../../features/goals/domain/goal-query';
import { calculateGoalProgress } from '../../features/goals/domain/goal-rules';
import { summarizeTransactions } from '../../features/transactions/domain/transaction-rules';
import { BudgetProgress } from '../../shared/models/budget';
import { DashboardData } from '../../shared/models/dashboard';
import { DateRange, isInRange } from '../../shared/models/period';
import { toIsoDate } from '../../shared/utils/date';
import { toIsoMonth } from '../../shared/utils/month';
import { AccountRepository } from '../repositories/account.repository';
import { BudgetRepository } from '../repositories/budget.repository';
import {
  DASHBOARD_HIGHLIGHTS,
  DASHBOARD_RECENT_LIMIT,
  DashboardRepository,
} from '../repositories/dashboard.repository';
import { GoalRepository } from '../repositories/goal.repository';
import { TransactionRepository } from '../repositories/transaction.repository';

/**
 * Dashboard calculado no navegador (demo e testes), a partir das contas, transações, orçamentos e
 * metas da pessoa, com as mesmas regras do servidor.
 */
@Injectable()
export class LocalDashboardRepository extends DashboardRepository {
  private readonly accounts = inject(AccountRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly budgets = inject(BudgetRepository);
  private readonly goals = inject(GoalRepository);
  private readonly today = inject(TODAY);

  load(userId: string, range: DateRange): Observable<DashboardData> {
    return defer(async () => {
      const [accounts, transactions, budgets, goals] = await Promise.all([
        firstValueFrom(this.accounts.listByUser(userId)),
        firstValueFrom(this.transactions.listByUser(userId)),
        firstValueFrom(this.budgets.listByUser(userId)),
        firstValueFrom(this.goals.listByUser(userId)),
      ]);
      const today = this.today();
      const active = accounts.filter((account) => !account.isArchived);
      const inPeriod = transactions.filter((transaction) => isInRange(transaction.date, range));
      const month = toIsoMonth(today);

      return {
        summary: summarizeTransactions(inPeriod),
        balance: {
          total: active.reduce(
            (total, account) => total + calculateBalance(account, transactions),
            0,
          ),
          activeAccounts: active.length,
        },
        incomeVsExpense: incomeVsExpense(inPeriod, range),
        balanceEvolution: balanceEvolution(accounts, transactions, range),
        recentTransactions: recentTransactions(transactions, range, DASHBOARD_RECENT_LIMIT),
        budgetHighlights: budgets
          .map((budget) => budgetProgress(budget, transactions, month))
          .filter((item): item is BudgetProgress => item !== null)
          .sort((a, b) => b.percent - a.percent)
          .slice(0, DASHBOARD_HIGHLIGHTS),
        goalHighlights: queryGoals(
          goals.map((goal) => calculateGoalProgress(goal, toIsoDate(today))),
          'active',
        )
          .filter((goal) => goal.status !== 'completed')
          .slice(0, DASHBOARD_HIGHLIGHTS),
      };
    });
  }
}
