import { Account } from '../../../shared/models/account';
import { Transaction } from '../../../shared/models/transaction';
import {
  balanceEvolution,
  incomeVsExpense,
  periodBuckets,
  recentTransactions,
} from './dashboard-metrics';

const NOVEMBER = { start: '2026-11-01', end: '2026-11-30' };
const LAST_3_MONTHS = { start: '2026-09-01', end: '2026-11-30' };

function account(overrides: Partial<Account>): Account {
  return {
    id: 'a1',
    userId: 'u1',
    name: 'Conta',
    type: 'checking',
    institution: null,
    initialBalance: 0,
    color: '#1565c0',
    icon: 'account_balance',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: 'u1',
    type: 'expense',
    description: 'Transação',
    amount: 1_000,
    date: '2026-11-10',
    accountId: 'a1',
    creditCardId: null,
    invoiceMonth: null,
    destinationAccountId: null,
    categoryId: 'c1',
    status: 'completed',
    notes: null,
    createdAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('periodBuckets', () => {
  it('splits a single month into blocks of 7 days', () => {
    expect(periodBuckets(NOVEMBER).map((bucket) => bucket.label)).toEqual([
      '01–07',
      '08–14',
      '15–21',
      '22–28',
      '29–30',
    ]);
    expect(periodBuckets(NOVEMBER)[4]).toEqual({
      start: '2026-11-29',
      end: '2026-11-30',
      label: '29–30',
    });
  });

  it('groups several months by month', () => {
    expect(periodBuckets(LAST_3_MONTHS)).toEqual([
      { start: '2026-09-01', end: '2026-09-30', label: 'set/26' },
      { start: '2026-10-01', end: '2026-10-31', label: 'out/26' },
      { start: '2026-11-01', end: '2026-11-30', label: 'nov/26' },
    ]);
  });

  it('returns no bucket for an invalid range', () => {
    expect(periodBuckets({ start: '2026-11-30', end: '2026-11-01' })).toEqual([]);
  });
});

describe('incomeVsExpense', () => {
  it('sums completed income and expenses per bucket, ignoring transfers and pending', () => {
    const points = incomeVsExpense(
      [
        transaction({ type: 'income', amount: 500_000, date: '2026-09-05', categoryId: 'c2' }),
        transaction({ amount: 20_000, date: '2026-09-20' }),
        transaction({ amount: 5_000, date: '2026-11-02' }),
        transaction({ amount: 9_900, date: '2026-11-03', status: 'pending' }),
        transaction({
          type: 'transfer',
          amount: 100_000,
          date: '2026-11-04',
          categoryId: null,
          destinationAccountId: 'a2',
        }),
        transaction({ amount: 7_000, date: '2026-08-31' }),
      ],
      LAST_3_MONTHS,
    );

    expect(points).toEqual([
      { label: 'set/26', income: 500_000, expense: 20_000 },
      { label: 'out/26', income: 0, expense: 0 },
      { label: 'nov/26', income: 0, expense: 5_000 },
    ]);
  });
});

describe('balanceEvolution', () => {
  const accounts = [
    account({ id: 'a1', initialBalance: 100_000 }),
    account({ id: 'a2', initialBalance: 50_000 }),
    account({ id: 'old', initialBalance: 999_999, isArchived: true }),
  ];

  it('returns the consolidated balance of active accounts at the end of each day', () => {
    const points = balanceEvolution(
      accounts,
      [
        transaction({ amount: 10_000, date: '2026-10-15' }),
        transaction({ type: 'income', amount: 30_000, date: '2026-11-02', categoryId: 'c2' }),
        transaction({ amount: 5_000, date: '2026-11-02', accountId: 'a2' }),
        transaction({ amount: 2_000, date: '2026-11-03', status: 'pending' }),
        transaction({
          type: 'transfer',
          amount: 40_000,
          date: '2026-11-04',
          categoryId: null,
          destinationAccountId: 'a2',
        }),
        transaction({ amount: 1_000, date: '2026-11-05', accountId: 'old' }),
      ],
      { start: '2026-11-01', end: '2026-11-05' },
    );

    expect(points).toEqual([
      { date: '2026-11-01', balance: 140_000 },
      { date: '2026-11-02', balance: 165_000 },
      { date: '2026-11-03', balance: 165_000 },
      { date: '2026-11-04', balance: 165_000 },
      { date: '2026-11-05', balance: 165_000 },
    ]);
  });

  it('counts a transfer to an archived account as money leaving the active accounts', () => {
    const points = balanceEvolution(
      accounts,
      [
        transaction({
          type: 'transfer',
          amount: 20_000,
          date: '2026-11-01',
          categoryId: null,
          destinationAccountId: 'old',
        }),
      ],
      { start: '2026-11-01', end: '2026-11-01' },
    );

    expect(points).toEqual([{ date: '2026-11-01', balance: 130_000 }]);
  });

  it('has one point per day of the period', () => {
    expect(balanceEvolution(accounts, [], NOVEMBER)).toHaveLength(30);
  });
});

describe('recentTransactions', () => {
  it('returns the latest transactions of the period', () => {
    const list = [
      transaction({ description: 'Outubro', date: '2026-10-31' }),
      transaction({ description: 'Dia 3', date: '2026-11-03' }),
      transaction({ description: 'Dia 9', date: '2026-11-09' }),
      transaction({ description: 'Dia 5', date: '2026-11-05' }),
    ];

    expect(recentTransactions(list, NOVEMBER, 2).map((item) => item.description)).toEqual([
      'Dia 9',
      'Dia 5',
    ]);
  });
});
