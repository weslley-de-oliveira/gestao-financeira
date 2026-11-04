import { formatMonth, isIsoMonth, monthRange, shiftMonth, toIsoMonth } from './month';

describe('month utils', () => {
  it('converts and validates months', () => {
    expect(toIsoMonth(new Date(2026, 10, 15))).toBe('2026-11');
    expect(isIsoMonth('2026-11')).toBe(true);
    expect(isIsoMonth('2026-13')).toBe(false);
    expect(isIsoMonth('2026-1')).toBe(false);
    expect(isIsoMonth(undefined)).toBe(false);
  });

  it('gives the closed range of the month', () => {
    expect(monthRange('2026-11')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('shifts across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('formats in Portuguese', () => {
    expect(formatMonth('2026-11')).toBe('novembro de 2026');
    expect(() => formatMonth('x')).toThrow(RangeError);
  });
});
