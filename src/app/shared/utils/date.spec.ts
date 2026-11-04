import { isInRange, periodRange } from '../models/period';
import { formatIsoDate, isIsoDate, parseIsoDate, toIsoDate } from './date';

describe('date utils', () => {
  it('converts local dates to yyyy-MM-dd without shifting the day', () => {
    expect(toIsoDate(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(parseIsoDate('2026-01-31')).toEqual(new Date(2026, 0, 31));
  });

  it.each(['2026-02-30', '2026-13-01', '31/01/2026', '2026-1-1', ''])(
    'rejects "%s" as an ISO date',
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
      expect(isIsoDate(value)).toBe(false);
    },
  );

  it('formats ISO dates in the Brazilian pattern', () => {
    expect(formatIsoDate('2026-11-04')).toBe('04/11/2026');
  });

  describe('periodRange', () => {
    const today = new Date(2026, 0, 15);

    it('covers the current month', () => {
      expect(periodRange('current-month', today)).toEqual({
        start: '2026-01-01',
        end: '2026-01-31',
      });
    });

    it('covers the previous month, across years', () => {
      expect(periodRange('previous-month', today)).toEqual({
        start: '2025-12-01',
        end: '2025-12-31',
      });
    });

    it('covers the last three months including the current one', () => {
      expect(periodRange('last-3-months', today)).toEqual({
        start: '2025-11-01',
        end: '2026-01-31',
      });
    });

    it('checks dates inside the range inclusively', () => {
      const range = periodRange('current-month', today);
      expect(isInRange('2026-01-01', range)).toBe(true);
      expect(isInRange('2026-01-31', range)).toBe(true);
      expect(isInRange('2026-02-01', range)).toBe(false);
    });
  });
});
