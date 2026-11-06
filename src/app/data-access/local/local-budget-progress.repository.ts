import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { budgetProgress } from '../../features/budgets/domain/budget-rules';
import { BudgetProgress } from '../../shared/models/budget';
import { IsoMonth } from '../../shared/utils/month';
import { BudgetProgressRepository } from '../repositories/budget-progress.repository';
import { BudgetRepository } from '../repositories/budget.repository';
import { TransactionRepository } from '../repositories/transaction.repository';

/** Consumo calculado no navegador (demo e testes), com as mesmas regras do servidor. */
@Injectable()
export class LocalBudgetProgressRepository extends BudgetProgressRepository {
  private readonly budgets = inject(BudgetRepository);
  private readonly transactions = inject(TransactionRepository);

  listByMonth(userId: string, month: IsoMonth): Observable<BudgetProgress[]> {
    return defer(async () => {
      const [budgets, transactions] = await Promise.all([
        firstValueFrom(this.budgets.listByUser(userId)),
        firstValueFrom(this.transactions.listByUser(userId)),
      ]);
      return budgets
        .map((budget) => budgetProgress(budget, transactions, month))
        .filter((item): item is BudgetProgress => item !== null);
    });
  }
}
