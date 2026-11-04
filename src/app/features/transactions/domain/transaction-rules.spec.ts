import { Transaction } from '../../../shared/models/transaction';
import { ALL, defaultTransactionQuery, queryTransactions } from './transaction-query';
import {
  InvalidTransactionInputError,
  TransactionInput,
  TransactionReferences,
  assertValidReferences,
  normalizeTransactionInput,
  summarizeTransactions,
} from './transaction-rules';

const expense: TransactionInput = {
  type: 'expense',
  description: '  Mercado   do mês ',
  amount: 25_090,
  date: '2026-11-04',
  accountId: 'checking',
  creditCardId: null,
  destinationAccountId: null,
  categoryId: 'food',
  status: 'completed',
  notes: '   ',
};

const transfer: TransactionInput = {
  ...expense,
  type: 'transfer',
  description: 'Reserva',
  destinationAccountId: 'savings',
  categoryId: null,
};

function fieldOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof InvalidTransactionInputError) {
      return error.field;
    }
    throw error;
  }
  return undefined;
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.description ?? 'id',
    userId: 'user',
    ...expense,
    description: 'Transação',
    invoiceMonth: null,
    notes: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('transaction rules', () => {
  it('normalizes description and empty notes', () => {
    expect(normalizeTransactionInput(expense)).toMatchObject({
      description: 'Mercado do mês',
      notes: null,
    });
  });

  it.each([
    ['amount', { amount: 0 }],
    ['amount', { amount: -100 }],
    ['amount', { amount: 10.5 }],
    ['amount', { amount: Number.NaN }],
    ['amount', { amount: Infinity }],
    ['description', { description: '  ' }],
    ['date', { date: '2026-02-30' }],
    ['accountId', { accountId: '' }],
    ['categoryId', { categoryId: null }],
  ])('rejects an invalid %s', (field, overrides) => {
    expect(fieldOf(() => normalizeTransactionInput({ ...expense, ...overrides }))).toBe(field);
  });

  it('requires different origin and destination accounts in transfers', () => {
    expect(
      fieldOf(() => normalizeTransactionInput({ ...transfer, destinationAccountId: null })),
    ).toBe('destinationAccountId');
    expect(
      fieldOf(() => normalizeTransactionInput({ ...transfer, destinationAccountId: 'checking' })),
    ).toBe('destinationAccountId');
  });

  it('drops the category of transfers and the destination of incomes and expenses', () => {
    expect(normalizeTransactionInput({ ...transfer, categoryId: 'food' }).categoryId).toBeNull();
    expect(
      normalizeTransactionInput({ ...expense, destinationAccountId: 'savings' })
        .destinationAccountId,
    ).toBeNull();
  });

  describe('assertValidReferences', () => {
    const references: TransactionReferences = {
      accounts: [
        { id: 'checking', isArchived: false },
        { id: 'savings', isArchived: false },
        { id: 'old', isArchived: true },
      ],
      categories: [
        { id: 'food', type: 'expense', isArchived: false },
        { id: 'salary', type: 'income', isArchived: false },
        { id: 'old-category', type: 'expense', isArchived: true },
      ],
      creditCards: [
        { id: 'card', isArchived: false },
        { id: 'old-card', isArchived: true },
      ],
    };

    it('accepts existing active references', () => {
      expect(() => assertValidReferences(expense, references)).not.toThrow();
      expect(() => assertValidReferences(transfer, references)).not.toThrow();
    });

    it('rejects unknown or archived accounts in new transactions', () => {
      expect(fieldOf(() => assertValidReferences({ ...expense, accountId: 'x' }, references))).toBe(
        'accountId',
      );
      expect(
        fieldOf(() => assertValidReferences({ ...expense, accountId: 'old' }, references)),
      ).toBe('accountId');
      expect(
        fieldOf(() =>
          assertValidReferences({ ...transfer, destinationAccountId: 'old' }, references),
        ),
      ).toBe('destinationAccountId');
    });

    it('requires a category of the same type', () => {
      expect(
        fieldOf(() => assertValidReferences({ ...expense, categoryId: 'salary' }, references)),
      ).toBe('categoryId');
    });

    it('keeps archived references the transaction already had when editing', () => {
      const previous = { ...expense, accountId: 'old', categoryId: 'old-category' };
      expect(() => assertValidReferences(previous, references, previous)).not.toThrow();
      expect(fieldOf(() => assertValidReferences(previous, references, expense))).toBe('accountId');
    });

    it('validates the card of a purchase instead of an account', () => {
      const purchase = { ...expense, accountId: null, creditCardId: 'card' };
      expect(() => assertValidReferences(purchase, references)).not.toThrow();
      expect(
        fieldOf(() => assertValidReferences({ ...purchase, creditCardId: 'x' }, references)),
      ).toBe('creditCardId');

      const archived = { ...purchase, creditCardId: 'old-card' };
      expect(fieldOf(() => assertValidReferences(archived, references))).toBe('creditCardId');
      expect(() => assertValidReferences(archived, references, archived)).not.toThrow();
    });
  });

  describe('card purchases', () => {
    const purchase: TransactionInput = { ...expense, accountId: null, creditCardId: 'card' };

    it('are always completed expenses without an account', () => {
      expect(
        normalizeTransactionInput({ ...purchase, accountId: 'checking', status: 'pending' }),
      ).toMatchObject({ accountId: null, creditCardId: 'card', status: 'completed' });
    });

    it('cannot be incomes or transfers', () => {
      expect(fieldOf(() => normalizeTransactionInput({ ...purchase, type: 'income' }))).toBe(
        'creditCardId',
      );
      expect(
        fieldOf(() =>
          normalizeTransactionInput({
            ...purchase,
            type: 'transfer',
            destinationAccountId: 'savings',
          }),
        ),
      ).toBe('creditCardId');
    });

    it('requires an account when there is no card', () => {
      expect(fieldOf(() => normalizeTransactionInput({ ...expense, accountId: null }))).toBe(
        'accountId',
      );
    });

    it('count as expenses in the summary', () => {
      const summary = summarizeTransactions([
        transaction({ amount: 10_000 }),
        transaction({ amount: 5_000, accountId: null, creditCardId: 'card' }),
      ]);
      expect(summary.expense).toBe(15_000);
    });
  });

  it('summarizes completed incomes and expenses, excluding transfers', () => {
    const summary = summarizeTransactions([
      transaction({ type: 'income', amount: 500_000 }),
      transaction({ type: 'expense', amount: 120_050 }),
      transaction({ type: 'expense', amount: 99_999, status: 'pending' }),
      transaction({ type: 'transfer', amount: 100_000, destinationAccountId: 'savings' }),
    ]);

    expect(summary).toEqual({ income: 500_000, expense: 120_050, net: 379_950, pendingCount: 1 });
  });

  describe('queryTransactions', () => {
    const transactions = [
      transaction({ description: 'Mercado', date: '2026-11-03', amount: 30_000 }),
      transaction({
        description: 'Salário',
        type: 'income',
        categoryId: 'salary',
        date: '2026-11-05',
        amount: 500_000,
      }),
      transaction({
        description: 'Reserva',
        type: 'transfer',
        categoryId: null,
        destinationAccountId: 'savings',
        accountId: 'checking',
        date: '2026-11-04',
        amount: 100_000,
      }),
      transaction({
        description: 'Aluguel',
        date: '2026-10-10',
        status: 'pending',
        notes: 'Outubro',
      }),
      transaction({
        description: 'Farmácia',
        accountId: null,
        creditCardId: 'card',
        date: '2026-11-02',
        amount: 4_500,
      }),
    ];
    const november = { start: '2026-11-01', end: '2026-11-30' };

    function descriptions(
      overrides: Partial<ReturnType<typeof defaultTransactionQuery>>,
      range = november,
    ) {
      return queryTransactions(
        transactions,
        { ...defaultTransactionQuery(), ...overrides },
        range,
      ).map((t) => t.description);
    }

    it('limits to the period and sorts by most recent date', () => {
      expect(descriptions({})).toEqual(['Salário', 'Reserva', 'Mercado', 'Farmácia']);
    });

    it('filters card purchases by the card id in the account filter', () => {
      expect(descriptions({ accountId: 'card' })).toEqual(['Farmácia']);
      expect(descriptions({ accountId: 'checking' })).toEqual(['Salário', 'Reserva', 'Mercado']);
    });

    it('combines filters', () => {
      expect(descriptions({ type: 'expense' })).toEqual(['Mercado', 'Farmácia']);
      expect(descriptions({ accountId: 'savings' })).toEqual(['Reserva']);
      expect(descriptions({ categoryId: 'salary' })).toEqual(['Salário']);
      expect(
        descriptions({ status: 'pending' }, { start: '2026-01-01', end: '2026-12-31' }),
      ).toEqual(['Aluguel']);
      expect(
        descriptions(
          { accountId: ALL, search: 'outubro' },
          { start: '2026-10-01', end: '2026-10-31' },
        ),
      ).toEqual(['Aluguel']);
    });

    it('sorts by amount', () => {
      expect(descriptions({ sort: 'amount-asc' })).toEqual([
        'Farmácia',
        'Mercado',
        'Reserva',
        'Salário',
      ]);
      expect(descriptions({ sort: 'date-asc' })).toEqual([
        'Farmácia',
        'Mercado',
        'Reserva',
        'Salário',
      ]);
    });
  });
});
