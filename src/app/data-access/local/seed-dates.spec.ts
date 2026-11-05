import { monthsSinceAnchor, shiftSeedDates } from './seed-dates';

describe('monthsSinceAnchor', () => {
  it('counts calendar months between the anchor and today', () => {
    expect(monthsSinceAnchor('2026-11-05', new Date(2026, 10, 30))).toBe(0);
    expect(monthsSinceAnchor('2026-11-05', new Date(2026, 11, 1))).toBe(1);
    expect(monthsSinceAnchor('2026-11-28', new Date(2028, 0, 2))).toBe(14);
  });

  it('never goes back in time', () => {
    expect(monthsSinceAnchor('2026-11-05', new Date(2026, 5, 1))).toBe(0);
  });

  it('rejects an invalid anchor', () => {
    expect(() => monthsSinceAnchor('ontem', new Date())).toThrow(RangeError);
  });
});

describe('shiftSeedDates', () => {
  const seed = {
    transactions: [
      {
        description: '2026-11-05 não é data',
        date: '2026-11-28',
        invoiceMonth: '2026-12',
        amount: 2026,
        createdAt: '2026-11-28T12:00:00.000Z',
      },
    ],
    budgets: [{ limits: [{ month: '2026-06', amount: 100 }] }],
    goals: [{ deadline: null, contributions: [{ date: '2026-10-01' }] }],
  };

  it('moves dates, timestamps and months forward keeping the day', () => {
    const shifted = shiftSeedDates(seed, 2);

    expect(shifted.transactions[0]).toEqual({
      description: '2026-11-05 não é data',
      date: '2027-01-28',
      invoiceMonth: '2027-02',
      amount: 2026,
      createdAt: '2027-01-28T12:00:00.000Z',
    });
    expect(shifted.budgets[0].limits[0].month).toBe('2026-08');
    expect(shifted.goals[0]).toEqual({ deadline: null, contributions: [{ date: '2026-12-01' }] });
  });

  it('does not change the original seed', () => {
    shiftSeedDates(seed, 3);

    expect(seed.transactions[0].date).toBe('2026-11-28');
  });

  it('returns the seed as is when no month has passed', () => {
    expect(shiftSeedDates(seed, 0)).toBe(seed);
  });
});
