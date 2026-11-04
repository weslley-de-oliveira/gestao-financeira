import {
  BalanceMovement,
  calculateBalance,
  calculateTotalBalance,
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
