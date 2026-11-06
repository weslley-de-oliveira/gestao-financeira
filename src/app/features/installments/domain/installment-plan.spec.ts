import { addDays } from 'date-fns';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { shiftMonth } from '../../../shared/utils/month';
import { invoiceCycleFor } from '../../credit-cards/domain/invoice-cycle';
import { installmentDates, planInstallments, splitAmount } from './installment-plan';

// Os mesmos casos de `installment-plan.test.ts` da API, para as parcelas darem o mesmo resultado
// nos dois lados (a demo e a prévia do formulário calculam no navegador).
describe('installment plan', () => {
  describe('splitAmount', () => {
    it.each([
      [10_000, 3, [3_334, 3_333, 3_333]],
      [120_000, 10, Array.from({ length: 10 }, () => 12_000)],
      [5, 5, [1, 1, 1, 1, 1]],
      [7, 2, [4, 3]],
    ])('splits %i cents into %i installments', (total, count, expected) => {
      const parts = splitAmount(total, count);

      expect(parts).toEqual(expected);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    });

    it('refuses less than 1 cent per installment', () => {
      expect(() => splitAmount(4, 5)).toThrow(RangeError);
    });
  });

  describe('installmentDates', () => {
    it('starts on the purchase date and moves one invoice at a time, on the same day', () => {
      expect(installmentDates({ closingDay: 5, dueDay: 12 }, '2026-11-10', 3)).toEqual([
        { date: '2026-11-10', referenceMonth: '2026-12' },
        { date: '2026-12-10', referenceMonth: '2027-01' },
        { date: '2027-01-10', referenceMonth: '2027-02' },
      ]);
    });

    it('fits the day into the invoice cycle at the end of the month', () => {
      expect(installmentDates({ closingDay: 30, dueDay: 7 }, '2026-01-31', 4)).toEqual([
        { date: '2026-01-31', referenceMonth: '2026-03' },
        { date: '2026-02-28', referenceMonth: '2026-04' },
        { date: '2026-03-31', referenceMonth: '2026-05' },
        { date: '2026-04-30', referenceMonth: '2026-06' },
      ]);
    });

    it('puts each installment on the invoice after the previous one, for any card and day', () => {
      const start = parseIsoDate('2026-01-01')!;
      for (let closingDay = 1; closingDay <= 31; closingDay += 1) {
        for (const dueDay of [1, closingDay, 31]) {
          const days = { closingDay, dueDay };
          for (let offset = 0; offset < 366; offset += 1) {
            const purchase = toIsoDate(addDays(start, offset));
            const parcels = installmentDates(days, purchase, 13);

            expect(parcels[0].date).toBe(purchase);
            parcels.forEach(({ date, referenceMonth }, index) => {
              expect(invoiceCycleFor(days, date).referenceMonth).toBe(referenceMonth);
              if (index > 0) {
                expect(referenceMonth).toBe(shiftMonth(parcels[index - 1].referenceMonth, 1));
              }
            });
          }
        }
      }
    }, 60_000);
  });

  it('joins amount, date and invoice of each installment', () => {
    expect(
      planInstallments({ closingDay: 5, dueDay: 12 }, { amount: 10_000, date: '2026-11-04' }, 3),
    ).toEqual([
      { installmentNumber: 1, amount: 3_334, date: '2026-11-04', referenceMonth: '2026-11' },
      { installmentNumber: 2, amount: 3_333, date: '2026-12-04', referenceMonth: '2026-12' },
      { installmentNumber: 3, amount: 3_333, date: '2027-01-04', referenceMonth: '2027-01' },
    ]);
  });
});
