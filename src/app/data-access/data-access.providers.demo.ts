import { Provider } from '@angular/core';
import { AuthGateway } from '../core/auth/auth.gateway';
import { LocalAuthGateway } from '../core/auth/local-auth.gateway';
import { LocalAccountRepository } from './local/local-account.repository';
import { LocalBudgetRepository } from './local/local-budget.repository';
import { LocalCategoryRepository } from './local/local-category.repository';
import { LocalCreditCardRepository } from './local/local-credit-card.repository';
import { LocalDashboardRepository } from './local/local-dashboard.repository';
import { LocalDatabase } from './local/local-database';
import { LocalGoalRepository } from './local/local-goal.repository';
import { LocalInvoiceRepository } from './local/local-invoice.repository';
import { LocalTransactionRepository } from './local/local-transaction.repository';
import { LocalUserDataRepository } from './local/local-user-data.repository';
import { LocalUserRepository } from './local/local-user.repository';
import { AccountRepository } from './repositories/account.repository';
import { BudgetRepository } from './repositories/budget.repository';
import { CategoryRepository } from './repositories/category.repository';
import { CreditCardRepository } from './repositories/credit-card.repository';
import { DashboardRepository } from './repositories/dashboard.repository';
import { DemoData } from './repositories/demo-data';
import { GoalRepository } from './repositories/goal.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { UserDataRepository } from './repositories/user-data.repository';
import { UserRepository } from './repositories/user.repository';

/**
 * Implementações dos repositórios da demo publicada: dados no `localStorage`, iniciados pelo seed.
 * Substitui `data-access.providers.ts` na configuração `demo` do `angular.json`.
 */
export function provideDataAccess(): Provider[] {
  return [
    { provide: AuthGateway, useClass: LocalAuthGateway },
    LocalDatabase,
    { provide: DemoData, useExisting: LocalDatabase },
    { provide: UserRepository, useClass: LocalUserRepository },
    { provide: UserDataRepository, useClass: LocalUserDataRepository },
    { provide: AccountRepository, useClass: LocalAccountRepository },
    { provide: CategoryRepository, useClass: LocalCategoryRepository },
    { provide: TransactionRepository, useClass: LocalTransactionRepository },
    { provide: CreditCardRepository, useClass: LocalCreditCardRepository },
    { provide: InvoiceRepository, useClass: LocalInvoiceRepository },
    { provide: BudgetRepository, useClass: LocalBudgetRepository },
    { provide: GoalRepository, useClass: LocalGoalRepository },
    { provide: DashboardRepository, useClass: LocalDashboardRepository },
  ];
}
