import { Budget } from '../../../shared/models/budget';
import { Transaction } from '../../../shared/models/transaction';
import {
  InvalidBudgetInputError,
  budgetProgress,
  budgetState,
  limitForMonth,
  normalizeBudgetInput,
  progressBarValue,
  summarizeBudgets,
  withLimitFrom,
} from './budget-rules';

const budget: Budget = {
  id: 'budget',
  userId: 'user',
  categoryId: 'food',
  limits: [
    { month: '2026-09', amount: 50_000 },
    { month: '2026-11', amount: 80_000 },
  ],
  alertThreshold: 80,
  createdAt: '2026-09-01T00:00:00.000Z',
};

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.description ?? 'id',
    userId: 'user',
    type: 'expense',
    description: 'Compra',
    amount: 1_000,
    date: '2026-11-10',
    accountId: 'checking',
    creditCardId: null,
    invoiceMonth: null,
    destinationAccountId: null,
    categoryId: 'food',
    status: 'completed',
    notes: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('budget rules', () => {
  it('uses the limit in force in each month', () => {
    expect(limitForMonth(budget, '2026-08')).toBeNull();
    expect(limitForMonth(budget, '2026-09')).toBe(50_000);
    expect(limitForMonth(budget, '2026-10')).toBe(50_000);
    expect(limitForMonth(budget, '2026-11')).toBe(80_000);
    expect(limitForMonth(budget, '2027-03')).toBe(80_000);
  });

  it('applies a new limit from a month on, keeping the previous months', () => {
    expect(withLimitFrom(budget.limits, '2026-12', 90_000)).toEqual([
      ...budget.limits,
      { month: '2026-12', amount: 90_000 },
    ]);
    expect(withLimitFrom(budget.limits, '2026-11', 70_000)).toEqual([
      { month: '2026-09', amount: 50_000 },
      { month: '2026-11', amount: 70_000 },
    ]);
    // Voltar ao valor anterior no mesmo mês dispensa a vigência nova.
    expect(withLimitFrom(budget.limits, '2026-11', 50_000)).toEqual([
      { month: '2026-09', amount: 50_000 },
    ]);
    expect(withLimitFrom(budget.limits, '2026-12', 80_000)).toEqual(budget.limits);
  });

  it('counts completed expenses of the category in the month, pending ones apart', () => {
    const progress = budgetProgress(
      budget,
      [
        transaction({ description: 'Mercado', amount: 40_000 }),
        transaction({
          description: 'Cartão',
          amount: 20_000,
          accountId: null,
          creditCardId: 'card',
        }),
        transaction({ description: 'Pendente', amount: 5_000, status: 'pending' }),
        transaction({ description: 'Outubro', amount: 9_999, date: '2026-10-31' }),
        transaction({ description: 'Outra categoria', categoryId: 'fun' }),
        transaction({ description: 'Receita', type: 'income' }),
        transaction({
          description: 'Transferência',
          type: 'transfer',
          categoryId: null,
          destinationAccountId: 'savings',
        }),
      ],
      '2026-11',
    );

    expect(progress).toMatchObject({
      limit: 80_000,
      spent: 60_000,
      pending: 5_000,
      available: 20_000,
      percent: 75,
      state: 'ok',
    });
  });

  it('is not active before its first month', () => {
    expect(budgetProgress(budget, [], '2026-08')).toBeNull();
  });

  it('warns from the alert threshold and exceeds above 100%', () => {
    expect(budgetState(79.9, 80)).toBe('ok');
    expect(budgetState(80, 80)).toBe('warning');
    expect(budgetState(100, 80)).toBe('warning');
    expect(budgetState(100.01, 80)).toBe('exceeded');
    expect(budgetState(100, 100)).toBe('warning');
  });

  it('summarizes the month and clamps the progress bar', () => {
    const ok = budgetProgress(budget, [transaction({ amount: 10_000 })], '2026-11')!;
    const over = budgetProgress(
      { ...budget, id: 'b2', categoryId: 'fun' },
      [transaction({ amount: 100_000, categoryId: 'fun' })],
      '2026-11',
    )!;

    expect(summarizeBudgets([ok, over])).toEqual({
      limit: 160_000,
      spent: 110_000,
      available: 50_000,
      attentionCount: 1,
    });
    expect(over.available).toBe(-20_000);
    expect(progressBarValue(over)).toBe(100);
    expect(progressBarValue(ok)).toBe(13);
  });

  it('validates the input', () => {
    const input = { categoryId: 'food', limitAmount: 50_000, alertThreshold: 80 };
    const fieldOf = (changes: object) => {
      try {
        normalizeBudgetInput({ ...input, ...changes });
      } catch (error) {
        return error instanceof InvalidBudgetInputError ? error.field : 'other';
      }
      return undefined;
    };

    expect(fieldOf({})).toBeUndefined();
    expect(fieldOf({ categoryId: '' })).toBe('categoryId');
    for (const limitAmount of [0, -1, 10.5, Number.NaN]) {
      expect(fieldOf({ limitAmount })).toBe('limitAmount');
    }
    expect(fieldOf({ alertThreshold: 0 })).toBe('alertThreshold');
    expect(fieldOf({ alertThreshold: 83 })).toBe('alertThreshold');
  });
});
