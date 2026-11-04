import { TestBed } from '@angular/core/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedBudgets } from '../../../testing/budget-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { seedCreditCards } from '../../../testing/credit-card-fixtures';
import { seedGoals } from '../../../testing/goal-fixtures';
import { InMemoryAccountRepository } from '../../../testing/in-memory-account.repository';
import { InMemoryBudgetRepository } from '../../../testing/in-memory-budget.repository';
import { InMemoryCategoryRepository } from '../../../testing/in-memory-category.repository';
import { InMemoryCreditCardRepository } from '../../../testing/in-memory-credit-card.repository';
import { InMemoryGoalRepository } from '../../../testing/in-memory-goal.repository';
import { InMemoryTransactionRepository } from '../../../testing/in-memory-transaction.repository';
import { InMemoryUserRepository } from '../../../testing/in-memory-user.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { AccountsFacade } from '../../features/accounts/accounts.facade';
import { PREFERENCES_STORAGE_KEY, PreferencesService } from '../preferences/preferences.service';
import { PeriodService } from '../services/period.service';
import { AuthService } from './auth.service';

describe('AuthService account management', () => {
  let auth: AuthService;
  let userId: string;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    auth = TestBed.inject(AuthService);
    userId = await signInTestUser();
  });

  it('updates only the name, in the API and in the session', async () => {
    await auth.updateName('  Ana   Maria ');

    expect(auth.currentUser()).toMatchObject({ name: 'Ana Maria', email: 'ana@exemplo.com' });
    expect(TestBed.inject(InMemoryUserRepository).records[0].user.name).toBe('Ana Maria');

    await auth.restoreSession();
    expect(auth.currentUser()?.name).toBe('Ana Maria');
    await expect(auth.updateName('   ')).rejects.toBeInstanceOf(RangeError);
  });

  it('clears the in-memory state of the screens on logout', async () => {
    seedAccounts(userId, { name: 'Corrente' });
    const accounts = TestBed.inject(AccountsFacade);
    await accounts.load();
    TestBed.inject(PeriodService).select('last-3-months');

    await auth.logout();

    expect(auth.currentUser()).toBeNull();
    expect(accounts.accounts()).toEqual([]);
    expect(accounts.status()).toBe('loading');
    expect(TestBed.inject(PeriodService).selected()).toBe('current-month');
  });

  it('deletes the user, every record of theirs and the local preferences', async () => {
    seedAccounts(userId, {});
    seedCategories(userId, {});
    seedTransactions(userId, {});
    seedCreditCards(userId, {});
    seedBudgets(userId, {});
    seedGoals(userId, {});
    seedAccounts('someone-else', { id: 'other-account' });
    TestBed.inject(PreferencesService).setTheme('dark');

    await auth.deleteAccount();

    const collections: { userId: string }[][] = [
      TestBed.inject(InMemoryAccountRepository).records,
      TestBed.inject(InMemoryCategoryRepository).records,
      TestBed.inject(InMemoryTransactionRepository).records,
      TestBed.inject(InMemoryCreditCardRepository).records,
      TestBed.inject(InMemoryBudgetRepository).records,
      TestBed.inject(InMemoryGoalRepository).records,
    ];
    for (const records of collections) {
      expect(records.filter((record) => record.userId === userId)).toEqual([]);
    }
    expect(TestBed.inject(InMemoryAccountRepository).records).toHaveLength(1);
    expect(TestBed.inject(InMemoryUserRepository).records).toEqual([]);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(auth.currentUser()).toBeNull();
    await expect(auth.login({ email: 'ana@exemplo.com', password: 'senha123' })).rejects.toThrow();
  });
});
