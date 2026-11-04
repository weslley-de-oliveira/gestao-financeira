import { invoiceCycleFor } from './invoice-cycle';

describe('invoiceCycleFor', () => {
  const card = { closingDay: 5, dueDay: 12 };

  it('puts a purchase before the closing day in the invoice that closes this month', () => {
    expect(invoiceCycleFor(card, '2026-11-04')).toEqual({
      referenceMonth: '2026-11',
      start: '2026-10-05',
      end: '2026-11-04',
      closingDate: '2026-11-05',
      dueDate: '2026-11-12',
    });
  });

  it('moves a purchase on or after the closing day to the next invoice', () => {
    expect(invoiceCycleFor(card, '2026-11-05')).toMatchObject({
      referenceMonth: '2026-12',
      start: '2026-11-05',
      end: '2026-12-04',
      closingDate: '2026-12-05',
      dueDate: '2026-12-12',
    });
    expect(invoiceCycleFor(card, '2026-11-30').closingDate).toBe('2026-12-05');
  });

  it('is due in the following month when the due day is not after the closing day', () => {
    expect(invoiceCycleFor({ closingDay: 25, dueDay: 5 }, '2026-11-10')).toMatchObject({
      closingDate: '2026-11-25',
      dueDate: '2026-12-05',
      referenceMonth: '2026-12',
    });
  });

  it('crosses the year', () => {
    expect(invoiceCycleFor({ closingDay: 25, dueDay: 5 }, '2026-12-28')).toMatchObject({
      start: '2026-12-25',
      closingDate: '2027-01-25',
      dueDate: '2027-02-05',
      referenceMonth: '2027-02',
    });
  });

  it('uses the last day of shorter months, keeping the cycles contiguous', () => {
    const lastDay = { closingDay: 31, dueDay: 10 };

    expect(invoiceCycleFor(lastDay, '2027-02-27')).toMatchObject({
      start: '2027-01-31',
      end: '2027-02-27',
      closingDate: '2027-02-28',
      dueDate: '2027-03-10',
    });
    expect(invoiceCycleFor(lastDay, '2027-02-28')).toMatchObject({
      start: '2027-02-28',
      end: '2027-03-30',
      closingDate: '2027-03-31',
    });
    expect(invoiceCycleFor({ closingDay: 20, dueDay: 31 }, '2026-11-10').dueDate).toBe(
      '2026-11-30',
    );
  });

  it('rejects an invalid date', () => {
    expect(() => invoiceCycleFor(card, '2026-02-30')).toThrow(RangeError);
  });
});
