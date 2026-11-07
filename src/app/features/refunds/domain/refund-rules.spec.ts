import {
  InvalidRefundInputError,
  RefundInput,
  canRefund,
  defaultRefundDescription,
  normalizeRefundInput,
  remainingToRefund,
} from './refund-rules';

describe('refund rules', () => {
  const expense = { date: '2026-11-02', amount: 30_000 };
  const input: RefundInput = {
    description: '  Estorno:   Mercado ',
    amount: 10_000,
    date: '2026-11-03',
    notes: '  ',
  };

  function fieldOf(action: () => unknown): string | undefined {
    try {
      action();
    } catch (error) {
      if (error instanceof InvalidRefundInputError) {
        return error.field;
      }
      throw error;
    }
    return undefined;
  }

  it('refunds only completed expenses', () => {
    expect(canRefund({ type: 'expense', status: 'completed' })).toBe(true);
    expect(canRefund({ type: 'expense', status: 'pending' })).toBe(false);
    expect(canRefund({ type: 'income', status: 'completed' })).toBe(false);
    expect(canRefund({ type: 'refund', status: 'completed' })).toBe(false);
  });

  it('computes what is left to refund, leaving out the refund being edited', () => {
    const refunds = [
      { id: 'r1', amount: 10_000 },
      { id: 'r2', amount: 5_000 },
    ];

    expect(remainingToRefund(expense, refunds)).toBe(15_000);
    expect(remainingToRefund(expense, refunds, 'r1')).toBe(25_000);
  });

  it('suggests "Estorno: " and the expense description, within the length limit', () => {
    expect(defaultRefundDescription({ description: 'Mercado' })).toBe('Estorno: Mercado');
    expect(defaultRefundDescription({ description: 'x'.repeat(80) })).toHaveLength(80);
  });

  it('normalizes the text fields', () => {
    expect(normalizeRefundInput(input, expense, 30_000)).toEqual({
      description: 'Estorno: Mercado',
      amount: 10_000,
      date: '2026-11-03',
      notes: null,
    });
  });

  it('accepts the whole remaining amount on the day of the expense, and nothing beyond', () => {
    expect(() =>
      normalizeRefundInput({ ...input, amount: 15_000, date: '2026-11-02' }, expense, 15_000),
    ).not.toThrow();
    expect(fieldOf(() => normalizeRefundInput({ ...input, amount: 15_001 }, expense, 15_000))).toBe(
      'amount',
    );
    expect(fieldOf(() => normalizeRefundInput({ ...input, amount: 0 }, expense, 15_000))).toBe(
      'amount',
    );
    expect(
      fieldOf(() => normalizeRefundInput({ ...input, date: '2026-11-01' }, expense, 15_000)),
    ).toBe('date');
    expect(
      fieldOf(() => normalizeRefundInput({ ...input, description: ' ' }, expense, 15_000)),
    ).toBe('description');
  });
});
