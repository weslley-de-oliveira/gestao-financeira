import { Provider } from '@angular/core';
import { AccountRepository } from './repositories/account.repository';
import { BudgetRepository } from './repositories/budget.repository';
import { CategoryRepository } from './repositories/category.repository';
import { CreditCardRepository } from './repositories/credit-card.repository';
import { GoalRepository } from './repositories/goal.repository';
import { HttpAccountRepository } from './repositories/http-account.repository';
import { HttpBudgetRepository } from './repositories/http-budget.repository';
import { HttpCategoryRepository } from './repositories/http-category.repository';
import { HttpCreditCardRepository } from './repositories/http-credit-card.repository';
import { HttpGoalRepository } from './repositories/http-goal.repository';
import { HttpTransactionRepository } from './repositories/http-transaction.repository';
import { HttpUserDataRepository } from './repositories/http-user-data.repository';
import { HttpUserRepository } from './repositories/http-user.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { UserDataRepository } from './repositories/user-data.repository';
import { UserRepository } from './repositories/user.repository';

/**
 * Implementações dos repositórios: HTTP (JSON Server). Na build de demo (`ng build -c demo`), este
 * arquivo é substituído por `data-access.providers.demo.ts`, que usa o `localStorage`.
 */
export function provideDataAccess(): Provider[] {
  return [
    { provide: UserRepository, useClass: HttpUserRepository },
    { provide: UserDataRepository, useClass: HttpUserDataRepository },
    { provide: AccountRepository, useClass: HttpAccountRepository },
    { provide: CategoryRepository, useClass: HttpCategoryRepository },
    { provide: TransactionRepository, useClass: HttpTransactionRepository },
    { provide: CreditCardRepository, useClass: HttpCreditCardRepository },
    { provide: BudgetRepository, useClass: HttpBudgetRepository },
    { provide: GoalRepository, useClass: HttpGoalRepository },
  ];
}
