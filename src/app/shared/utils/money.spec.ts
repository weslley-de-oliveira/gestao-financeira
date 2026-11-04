import {
  applyMoneyMask,
  assertValidCents,
  formatMoneyInput,
  isValidCents,
  parseMoney,
} from './money';

describe('money', () => {
  it.each([
    ['0', 0],
    ['10', 1000],
    ['10,5', 1050],
    ['1234,56', 123456],
    ['1.234,56', 123456],
    ['1.234.567', 123456700],
    ['-15,90', -1590],
    ['R$ 7,00', 700],
    ['-R$ 7,00', -700],
    ['  42  ', 4200],
    ['-0', 0],
  ])('parses "%s" as %i cents', (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it.each(['', 'abc', '1,234', '12.34', '1.23,00', '10,', '1e3', 'Infinity', 'NaN', '--5'])(
    'rejects "%s"',
    (text) => {
      expect(parseMoney(text)).toBeNull();
    },
  );

  it('rejects amounts beyond the safe integer range', () => {
    expect(parseMoney('9'.repeat(20))).toBeNull();
  });

  it.each([
    [0, '0,00'],
    [5, '0,05'],
    [123456, '1.234,56'],
    [123456789, '1.234.567,89'],
    [-1590, '-15,90'],
  ])('formats %i cents for editing as "%s"', (cents, text) => {
    expect(formatMoneyInput(cents)).toBe(text);
    expect(parseMoney(text)).toBe(cents);
  });

  describe('applyMoneyMask', () => {
    it.each([
      ['', ''],
      ['abc', ''],
      ['1', '0,01'],
      ['0,001', '0,01'],
      ['0,012', '0,12'],
      ['0,123', '1,23'],
      ['1,234', '12,34'],
      ['123,456', '1.234,56'],
      ['1.234,5', '123,45'],
      ['0,0', '0,00'],
      ['R$ 7a', '0,07'],
      ['1,50-', '-1,50'],
      ['-1,50-', '1,50'],
      ['-0,00', '-0,00'],
    ])('masks "%s" as "%s"', (typed, masked) => {
      expect(applyMoneyMask(typed)).toBe(masked);
    });

    it('ignores the minus sign when negatives are not allowed', () => {
      expect(applyMoneyMask('1,50-', false)).toBe('1,50');
    });

    it('ignores digits beyond the maximum length', () => {
      expect(applyMoneyMask('9'.repeat(15))).toBe('9.999.999.999,99');
    });

    it('produces values the parser accepts', () => {
      expect(parseMoney(applyMoneyMask('-123456'))).toBe(-123_456);
      expect(parseMoney(applyMoneyMask('-0'))).toBe(0);
    });
  });

  it('accepts only finite integer cents', () => {
    expect(isValidCents(100)).toBe(true);
    expect(isValidCents(-100)).toBe(true);
    for (const value of [1.5, Number.NaN, Infinity, -Infinity, '100', null]) {
      expect(isValidCents(value)).toBe(false);
    }
    expect(() => assertValidCents(0.1, 'amount')).toThrow(RangeError);
  });
});
