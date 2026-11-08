import {
  BalanceMovement,
  calculateBalance,
  calculateTotalBalance,
  GoalContributionMovement,
  goalMovement,
  goalMovements,
  goalsTotal,
  movementEffect,
} from './account-balance';

describe('account balance', () => {
  const checking = { id: 'checking', initialBalance: 100_000 };
  const savings = { id: 'savings', initialBalance: 50_000 };

  it('starts from the initial balance', () => {
    expect(calculateBalance(checking, [])).toBe(100_000);
    expect(calculateBalance({ id: 'x', initialBalance: -2_500 }, [])).toBe(-2_500);
  });

  it('adds incomes and subtracts expenses of the account only', () => {
    const movements: BalanceMovement[] = [
      { type: 'income', amount: 30_000, accountId: 'checking' },
      { type: 'expense', amount: 12_345, accountId: 'checking' },
      { type: 'expense', amount: 99_999, accountId: 'savings' },
    ];

    expect(calculateBalance(checking, movements)).toBe(117_655);
  });

  it('debits the origin and credits the destination of a transfer', () => {
    const transfer: BalanceMovement = {
      type: 'transfer',
      amount: 20_000,
      accountId: 'checking',
      destinationAccountId: 'savings',
    };

    expect(movementEffect(transfer, 'checking')).toBe(-20_000);
    expect(movementEffect(transfer, 'savings')).toBe(20_000);
    expect(movementEffect(transfer, 'other')).toBe(0);
  });

  it('debits invoice payments and ignores card purchases', () => {
    const movements: BalanceMovement[] = [
      { type: 'expense', amount: 40_000, accountId: null },
      { type: 'invoice-payment', amount: 40_000, accountId: 'checking' },
    ];

    expect(calculateBalance(checking, movements)).toBe(60_000);
    expect(calculateBalance(savings, movements)).toBe(50_000);
  });

  it('ignores pending movements', () => {
    const movements: BalanceMovement[] = [
      { type: 'income', amount: 30_000, accountId: 'checking', status: 'completed' },
      { type: 'expense', amount: 50_000, accountId: 'checking', status: 'pending' },
      {
        type: 'transfer',
        amount: 10_000,
        accountId: 'checking',
        destinationAccountId: 'savings',
        status: 'pending',
      },
    ];

    expect(calculateBalance(checking, movements)).toBe(130_000);
    expect(calculateBalance(savings, movements)).toBe(50_000);
  });

  it('keeps the consolidated balance unchanged after transfers', () => {
    const before = calculateTotalBalance([checking, savings], []);
    const after = calculateTotalBalance(
      [checking, savings],
      [
        {
          type: 'transfer',
          amount: 20_000,
          accountId: 'checking',
          destinationAccountId: 'savings',
        },
        { type: 'transfer', amount: 7_550, accountId: 'savings', destinationAccountId: 'checking' },
      ],
    );

    expect(after).toBe(before);
    expect(before).toBe(150_000);
  });

  it('keeps cent precision where floating point would drift', () => {
    const movements: BalanceMovement[] = Array.from({ length: 10 }, () => ({
      type: 'income' as const,
      amount: 10,
      accountId: 'checking',
    }));

    expect(calculateBalance({ id: 'checking', initialBalance: 20 }, movements)).toBe(120);
  });

  it.each([Number.NaN, Infinity, 10.5, -100])(
    'rejects an invalid movement amount (%s)',
    (amount) => {
      expect(() =>
        calculateBalance(checking, [{ type: 'income', amount, accountId: 'checking' }]),
      ).toThrow(RangeError);
    },
  );

  it('rejects an invalid initial balance', () => {
    expect(() => calculateBalance({ id: 'x', initialBalance: Number.NaN }, [])).toThrow(RangeError);
  });
});

// Os mesmos casos de `account-balance.test.ts` da API: a regra dá o mesmo resultado nos dois lados.
describe('goal contributions in the balance', () => {
  const checking = { id: 'checking', initialBalance: 100_000 };
  const contribution = (
    overrides: Partial<GoalContributionMovement>,
  ): GoalContributionMovement => ({
    type: 'deposit',
    amount: 10_000,
    accountId: 'checking',
    date: '2026-11-01',
    ...overrides,
  });

  it('takes a deposit out of the account and puts a withdrawal back', () => {
    const movements = goalMovements([
      contribution({ amount: 30_000 }),
      contribution({ type: 'withdrawal', amount: 5_000 }),
    ]);

    expect(calculateBalance(checking, movements)).toBe(75_000);
  });

  it('only changes the goal when there is no account', () => {
    expect(goalMovement(contribution({ accountId: null }))).toBeNull();
    expect(calculateBalance(checking, goalMovements([contribution({ accountId: null })]))).toBe(
      100_000,
    );
  });

  it('does not touch other accounts', () => {
    const movements = goalMovements([contribution({ accountId: 'savings' })]);

    expect(calculateBalance(checking, movements)).toBe(100_000);
  });

  it('becomes half a transfer, which is neither income nor expense', () => {
    expect(goalMovement(contribution({}))).toEqual({
      type: 'transfer',
      amount: 10_000,
      accountId: 'checking',
      destinationAccountId: null,
      status: 'completed',
      date: '2026-11-01',
    });
    expect(goalMovement(contribution({ type: 'withdrawal' }))).toEqual(
      expect.objectContaining({ accountId: null, destinationAccountId: 'checking' }),
    );
  });

  it('adds up how much of each account is saved in goals', () => {
    const contributions = [
      contribution({ amount: 30_000 }),
      contribution({ type: 'withdrawal', amount: 5_000 }),
      contribution({ accountId: 'savings', amount: 99_999 }),
      contribution({ accountId: null, amount: 1_000 }),
    ];

    expect(goalsTotal('checking', contributions)).toBe(25_000);
    expect(goalsTotal('savings', contributions)).toBe(99_999);
    expect(goalsTotal('other', contributions)).toBe(0);
  });
});
