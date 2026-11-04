import { CreditCard } from '../../../shared/models/credit-card';
import { calculateCardUsage, usagePercent } from './card-usage';

describe('card usage', () => {
  const card: CreditCard = {
    id: 'card',
    userId: 'user',
    name: 'Roxinho',
    brand: 'mastercard',
    lastFourDigits: '4321',
    creditLimit: 100_000,
    closingDay: 5,
    dueDay: 12,
    paymentAccountId: 'checking',
    color: '#6a1b9a',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const purchases = [
    { type: 'expense' as const, creditCardId: 'card', amount: 20_000, date: '2026-10-20' },
    { type: 'expense' as const, creditCardId: 'card', amount: 15_050, date: '2026-11-04' },
    { type: 'expense' as const, creditCardId: 'card', amount: 9_990, date: '2026-11-05' },
    { type: 'expense' as const, creditCardId: 'other', amount: 50_000, date: '2026-11-01' },
    { type: 'expense' as const, creditCardId: null, amount: 70_000, date: '2026-11-01' },
  ];

  it('commits the limit with all purchases of the card', () => {
    const usage = calculateCardUsage(card, purchases, '2026-11-15');

    expect(usage.usedLimit).toBe(45_040);
    expect(usage.availableLimit).toBe(54_960);
  });

  it('releases the limit with the paid invoices of the card', () => {
    const payments = [
      {
        type: 'invoice-payment' as const,
        creditCardId: 'card',
        amount: 35_050,
        date: '2026-11-10',
      },
      {
        type: 'invoice-payment' as const,
        creditCardId: 'other',
        amount: 9_000,
        date: '2026-11-10',
      },
    ];

    const usage = calculateCardUsage(card, [...purchases, ...payments], '2026-11-15');

    expect(usage.usedLimit).toBe(9_990);
    expect(usage.availableLimit).toBe(90_010);
  });

  it('sums only the purchases of the open invoice', () => {
    // Em 04/11 a fatura aberta é a que fecha em 05/11 (compras de 05/10 a 04/11).
    expect(calculateCardUsage(card, purchases, '2026-11-04').nextInvoice).toMatchObject({
      closingDate: '2026-11-05',
      dueDate: '2026-11-12',
      amount: 35_050,
    });
    // A partir de 05/11, a aberta é a que fecha em 05/12.
    expect(calculateCardUsage(card, purchases, '2026-11-15').nextInvoice).toMatchObject({
      closingDate: '2026-12-05',
      amount: 9_990,
    });
  });

  it('goes negative when the limit is exceeded', () => {
    const usage = calculateCardUsage({ ...card, creditLimit: 40_000 }, purchases, '2026-11-15');

    expect(usage.availableLimit).toBe(-5_040);
    expect(usagePercent(usage)).toBe(100);
  });

  it('computes the usage percentage within 0–100', () => {
    expect(usagePercent({ creditLimit: 100_000, usedLimit: 0 })).toBe(0);
    expect(usagePercent({ creditLimit: 100_000, usedLimit: 45_040 })).toBe(45);
    expect(usagePercent({ creditLimit: 100_000, usedLimit: 250_000 })).toBe(100);
  });
});
