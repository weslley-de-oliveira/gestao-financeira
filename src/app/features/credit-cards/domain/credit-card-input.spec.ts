import {
  CreditCardInput,
  InvalidCreditCardInputError,
  normalizeCreditCardInput,
} from './credit-card-input';

describe('normalizeCreditCardInput', () => {
  const input: CreditCardInput = {
    name: '  Cartão   principal ',
    brand: 'visa',
    lastFourDigits: '0042',
    creditLimit: 500_000,
    closingDay: 3,
    dueDay: 10,
    paymentAccountId: 'checking',
    color: '#6a1b9a',
    isArchived: false,
  };

  function fieldOf(changes: Partial<CreditCardInput>): string | undefined {
    try {
      normalizeCreditCardInput({ ...input, ...changes });
    } catch (error) {
      if (error instanceof InvalidCreditCardInputError) {
        return error.field;
      }
      throw error;
    }
    return undefined;
  }

  it('collapses the whitespace of the name', () => {
    expect(normalizeCreditCardInput(input).name).toBe('Cartão principal');
  });

  it.each(['', '123', '12345', '4111111111111111', '12a4', '12 4'])(
    'accepts only the last four digits, never a full card number (%s)',
    (lastFourDigits) => {
      expect(fieldOf({ lastFourDigits })).toBe('lastFourDigits');
    },
  );

  it.each([0, -100, 10.5, Number.NaN, Infinity])('rejects an invalid limit (%s)', (creditLimit) => {
    expect(fieldOf({ creditLimit })).toBe('creditLimit');
  });

  it('validates the closing and due days', () => {
    expect(fieldOf({ closingDay: 0 })).toBe('closingDay');
    expect(fieldOf({ closingDay: 32 })).toBe('closingDay');
    expect(fieldOf({ closingDay: 2.5 })).toBe('closingDay');
    expect(fieldOf({ dueDay: 32 })).toBe('dueDay');
    expect(fieldOf({ dueDay: 3 })).toBe('dueDay');
    expect(fieldOf({ closingDay: 31, dueDay: 8 })).toBeUndefined();
  });

  it('validates the other fields', () => {
    expect(fieldOf({ name: '   ' })).toBe('name');
    expect(fieldOf({ name: 'x'.repeat(41) })).toBe('name');
    expect(fieldOf({ brand: 'diners' as never })).toBe('brand');
    expect(fieldOf({ paymentAccountId: '' })).toBe('paymentAccountId');
    expect(fieldOf({ color: '#000000' })).toBe('color');
  });
});
