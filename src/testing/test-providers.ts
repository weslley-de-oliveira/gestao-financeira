import { Provider } from '@angular/core';
import { AuthGateway } from '../app/core/auth/auth.gateway';
import { LocalAuthGateway } from '../app/core/auth/local-auth.gateway';
import { TODAY } from '../app/core/services/today';
import { PBKDF2_ITERATIONS } from '../app/core/security/password-hasher';
import { AccountRepository } from '../app/data-access/repositories/account.repository';
import { BudgetRepository } from '../app/data-access/repositories/budget.repository';
import { CategoryRepository } from '../app/data-access/repositories/category.repository';
import { CreditCardRepository } from '../app/data-access/repositories/credit-card.repository';
import { GoalRepository } from '../app/data-access/repositories/goal.repository';
import { TransactionRepository } from '../app/data-access/repositories/transaction.repository';
import { UserDataRepository } from '../app/data-access/repositories/user-data.repository';
import { UserRepository } from '../app/data-access/repositories/user.repository';
import { CHART_RENDERER } from '../app/shared/components/chart/chart-spec';
import { FakeChartRenderer } from './fake-chart-renderer';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryBudgetRepository } from './in-memory-budget.repository';
import { InMemoryCategoryRepository } from './in-memory-category.repository';
import { InMemoryCreditCardRepository } from './in-memory-credit-card.repository';
import { InMemoryGoalRepository } from './in-memory-goal.repository';
import { InMemoryTransactionRepository } from './in-memory-transaction.repository';
import { InMemoryUserDataRepository } from './in-memory-user-data.repository';
import { InMemoryUserRepository } from './in-memory-user.repository';

/** "Hoje" fixo nos testes: 15/11/2026. */
export const TEST_TODAY = new Date(2026, 10, 15);

/**
 * Substitui a API por memória e o Chart.js por um registro dos gráficos, fixa a data
 * atual e reduz as iterações do PBKDF2 para acelerar os testes.
 */
export const TEST_PROVIDERS: Provider[] = [
  { provide: AuthGateway, useClass: LocalAuthGateway },
  InMemoryUserRepository,
  { provide: UserRepository, useExisting: InMemoryUserRepository },
  InMemoryAccountRepository,
  { provide: AccountRepository, useExisting: InMemoryAccountRepository },
  InMemoryCategoryRepository,
  { provide: CategoryRepository, useExisting: InMemoryCategoryRepository },
  InMemoryTransactionRepository,
  { provide: TransactionRepository, useExisting: InMemoryTransactionRepository },
  InMemoryCreditCardRepository,
  { provide: CreditCardRepository, useExisting: InMemoryCreditCardRepository },
  InMemoryBudgetRepository,
  { provide: BudgetRepository, useExisting: InMemoryBudgetRepository },
  InMemoryGoalRepository,
  { provide: GoalRepository, useExisting: InMemoryGoalRepository },
  { provide: UserDataRepository, useClass: InMemoryUserDataRepository },
  FakeChartRenderer,
  { provide: CHART_RENDERER, useExisting: FakeChartRenderer },
  { provide: TODAY, useValue: () => new Date(TEST_TODAY) },
  { provide: PBKDF2_ITERATIONS, useValue: 1_000 },
];
