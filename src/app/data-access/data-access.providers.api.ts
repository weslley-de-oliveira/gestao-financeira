import { Provider } from '@angular/core';
import { ApiAuthGateway } from '../core/auth/api-auth.gateway';
import { AuthGateway } from '../core/auth/auth.gateway';
import { ApiAccountRepository } from './api/api-account.repository';
import { ApiBudgetRepository } from './api/api-budget.repository';
import { ApiCategoryRepository } from './api/api-category.repository';
import { ApiCreditCardRepository } from './api/api-credit-card.repository';
import { ApiGoalRepository } from './api/api-goal.repository';
import { ApiTransactionRepository } from './api/api-transaction.repository';
import { API_BASE_URL } from './api/api.config';
import { AccountRepository } from './repositories/account.repository';
import { BudgetRepository } from './repositories/budget.repository';
import { CategoryRepository } from './repositories/category.repository';
import { CreditCardRepository } from './repositories/credit-card.repository';
import { GoalRepository } from './repositories/goal.repository';
import { TransactionRepository } from './repositories/transaction.repository';

/**
 * Implementações dos repositórios na API real (`gestao-financeira-api`). As chamadas vão para
 * `/api/v1` na mesma origem: em desenvolvimento, o proxy do `ng serve` (`proxy.conf.json`)
 * encaminha para a API, e o cookie de sessão é enviado sem CORS. Substitui
 * `data-access.providers.ts` na configuração `api` do `angular.json`.
 */
export function provideDataAccess(): Provider[] {
  return [
    { provide: API_BASE_URL, useValue: '/api/v1' },
    { provide: AuthGateway, useClass: ApiAuthGateway },
    { provide: AccountRepository, useClass: ApiAccountRepository },
    { provide: CategoryRepository, useClass: ApiCategoryRepository },
    { provide: TransactionRepository, useClass: ApiTransactionRepository },
    { provide: CreditCardRepository, useClass: ApiCreditCardRepository },
    { provide: BudgetRepository, useClass: ApiBudgetRepository },
    { provide: GoalRepository, useClass: ApiGoalRepository },
  ];
}
