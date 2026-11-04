import { TestBed } from '@angular/core/testing';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedBudgets } from '../../../testing/budget-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { InMemoryBudgetRepository } from '../../../testing/in-memory-budget.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { BudgetNotFoundError, BudgetsFacade, DuplicateBudgetError } from './budgets.facade';
import { BudgetInput, InvalidBudgetInputError } from './domain/budget-rules';

describe('BudgetsFacade', () => {
  let facade: BudgetsFacade;
  let repository: InMemoryBudgetRepository;
  let userId: string;

  const input: BudgetInput = { categoryId: 'category-1', limitAmount: 80_000, alertThreshold: 80 };

  // Hoje: 15/11/2026.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(BudgetsFacade);
    repository = TestBed.inject(InMemoryBudgetRepository);
    userId = await signInTestUser();
    seedCategories(
      userId,
      { name: 'Mercado' },
      { name: 'Salário', type: 'income' },
      { name: 'Antiga', isArchived: true },
    );
  });

  it('creates a budget starting in the current month', async () => {
    await facade.create(input);

    expect(repository.records).toEqual([
      expect.objectContaining({
        userId,
        categoryId: 'category-1',
        limits: [{ month: '2026-11', amount: 80_000 }],
        alertThreshold: 80,
      }),
    ]);
    expect(facade.budgets()).toHaveLength(1);
  });

  it('allows one budget per category', async () => {
    await facade.create(input);

    await expect(facade.create({ ...input, limitAmount: 1_000 })).rejects.toBeInstanceOf(
      DuplicateBudgetError,
    );
    expect(repository.records).toHaveLength(1);
  });

  it('requires an active expense category of the user', async () => {
    for (const categoryId of ['category-2', 'category-3', 'unknown']) {
      await expect(facade.create({ ...input, categoryId })).rejects.toMatchObject({
        field: 'categoryId',
      });
    }
    await expect(facade.create({ ...input, alertThreshold: 33 })).rejects.toBeInstanceOf(
      InvalidBudgetInputError,
    );
  });

  it('applies a new limit from the current month on and keeps the category', async () => {
    const [budget] = seedBudgets(userId, { limits: [{ month: '2026-09', amount: 50_000 }] });

    await facade.update(budget.id, { ...input, limitAmount: 90_000, alertThreshold: 90 });

    expect(repository.records[0]).toMatchObject({
      limits: [
        { month: '2026-09', amount: 50_000 },
        { month: '2026-11', amount: 90_000 },
      ],
      alertThreshold: 90,
    });
    await expect(
      facade.update(budget.id, { ...input, categoryId: 'category-3' }),
    ).rejects.toMatchObject({ field: 'categoryId' });
  });

  it('deletes only budgets of the current user', async () => {
    const [mine] = seedBudgets(userId, {});
    seedBudgets('someone-else', { categoryId: 'x' });

    await facade.load();
    expect(facade.budgets()).toHaveLength(1);

    await expect(facade.delete('budget-2')).rejects.toBeInstanceOf(BudgetNotFoundError);
    await facade.delete(mine.id);
    expect(repository.records.map((record) => record.userId)).toEqual(['someone-else']);
  });
});
