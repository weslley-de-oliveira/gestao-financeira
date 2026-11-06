import { Provider } from '@angular/core';
import { ApiAuthGateway } from '../core/auth/api-auth.gateway';
import { AuthGateway } from '../core/auth/auth.gateway';
import { ApiAccountRepository } from './api/api-account.repository';
import { ApiBudgetProgressRepository } from './api/api-budget-progress.repository';
import { ApiBudgetRepository } from './api/api-budget.repository';
import { ApiCategoryRepository } from './api/api-category.repository';
import { ApiCreditCardRepository } from './api/api-credit-card.repository';
import { ApiDashboardRepository } from './api/api-dashboard.repository';
import { ApiGoalRepository } from './api/api-goal.repository';
import { ApiInvoiceRepository } from './api/api-invoice.repository';
import { ApiTransactionRepository } from './api/api-transaction.repository';
import { AccountRepository } from './repositories/account.repository';
import { BudgetProgressRepository } from './repositories/budget-progress.repository';
import { BudgetRepository } from './repositories/budget.repository';
import { CategoryRepository } from './repositories/category.repository';
import { CreditCardRepository } from './repositories/credit-card.repository';
import { DashboardRepository } from './repositories/dashboard.repository';
import { GoalRepository } from './repositories/goal.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { TransactionRepository } from './repositories/transaction.repository';

/**
 * Implementações dos repositórios: a API real (`gestao-financeira-api`), em `/api/v1` na mesma
 * origem. Em desenvolvimento, o proxy do `ng serve` (`proxy.conf.json`) encaminha para a API, e o
 * cookie de sessão é enviado sem CORS. Na build de demo (`ng build -c demo`), este arquivo é
 * substituído por `data-access.providers.demo.ts`, que usa o `localStorage`.
 */
export function provideDataAccess(): Provider[] {
  return [
    { provide: AuthGateway, useClass: ApiAuthGateway },
    { provide: AccountRepository, useClass: ApiAccountRepository },
    { provide: CategoryRepository, useClass: ApiCategoryRepository },
    { provide: TransactionRepository, useClass: ApiTransactionRepository },
    { provide: CreditCardRepository, useClass: ApiCreditCardRepository },
    { provide: InvoiceRepository, useClass: ApiInvoiceRepository },
    { provide: BudgetRepository, useClass: ApiBudgetRepository },
    { provide: BudgetProgressRepository, useClass: ApiBudgetProgressRepository },
    { provide: GoalRepository, useClass: ApiGoalRepository },
    { provide: DashboardRepository, useClass: ApiDashboardRepository },
  ];
}
