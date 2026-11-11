import { Budget } from '../../../shared/models/budget';
import { CreditCard } from '../../../shared/models/credit-card';
import { Transaction } from '../../../shared/models/transaction';
import { calculateBalance } from '../../accounts/domain/account-balance';
import { budgetProgress } from '../../budgets/domain/budget-rules';
import { calculateCardUsage } from '../../credit-cards/domain/card-usage';
import { incomeVsExpense } from '../../dashboard/domain/dashboard-metrics';
import { buildInvoice, canPayInvoice, listInvoices } from '../../invoices/domain/invoice-rules';
import { summarizeTransactions } from './transaction-rules';

/**
 * Estornos em conta e no cartão, em vários meses: o mesmo cenário do teste de paridade da API
 * (`refunds.parity.test.ts`), com os mesmos resultados esperados.
 */
describe('refund effects', () => {
  const TODAY = '2026-11-15';
  const card: CreditCard = {
    id: 'card',
    userId: 'user',
    name: 'Cartão principal',
    brand: 'visa',
    lastFourDigits: '1234',
    creditLimit: 500_000,
    closingDay: 5,
    dueDay: 12,
    paymentAccountId: 'account',
    color: '#6a1b9a',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const budget: Budget = {
    id: 'budget',
    userId: 'user',
    categoryId: 'food',
    limits: [{ month: '2026-01', amount: 60_000 }],
    alertThreshold: 80,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  let sequence = 0;
  function transaction(overrides: Partial<Transaction>): Transaction {
    sequence++;
    return {
      id: `t${sequence}`,
      userId: 'user',
      type: 'expense',
      description: 'Despesa',
      amount: 1_000,
      date: '2026-11-01',
      accountId: null,
      creditCardId: null,
      invoiceMonth: null,
      destinationAccountId: null,
      categoryId: 'food',
      status: 'completed',
      notes: null,
      createdAt: `2026-11-01T10:00:${String(sequence).padStart(2, '0')}.000Z`,
      ...overrides,
    };
  }
  function refund(of: Transaction, amount: number, date: string): Transaction {
    return transaction({
      type: 'refund',
      description: `Estorno: ${of.description}`,
      amount,
      date,
      accountId: of.accountId,
      creditCardId: of.creditCardId,
      categoryId: null,
      refundedTransactionId: of.id,
    });
  }

  const inAccount = transaction({ amount: 30_000, date: '2026-11-02', accountId: 'account' });
  const october = transaction({ amount: 25_000, date: '2026-10-20', creditCardId: 'card' });
  const november = transaction({ amount: 8_000, date: '2026-11-08', creditCardId: 'card' });
  const all = [
    inAccount,
    october,
    november,
    refund(inAccount, 10_000, '2026-11-03'),
    refund(inAccount, 5_000, '2026-12-01'),
    // Estorno da compra de outubro na fatura aberta de dezembro (maior que as compras dela).
    refund(october, 15_000, '2026-11-10'),
    refund(november, 2_000, '2026-11-12'),
  ];

  it('gives the money back to the account', () => {
    expect(calculateBalance({ id: 'account', initialBalance: 100_000 }, all)).toBe(
      100_000 - 30_000 + 10_000 + 5_000,
    );
  });

  it('frees the card limit and lowers the open invoice', () => {
    const usage = calculateCardUsage(card, all, TODAY);

    expect(usage.usedLimit).toBe(25_000 + 8_000 - 15_000 - 2_000);
    expect(usage.availableLimit).toBe(500_000 - 16_000);
    expect(usage.nextInvoice).toMatchObject({ referenceMonth: '2026-12', amount: -9_000 });
  });

  it('subtracts the refunds of the cycle from the invoice, which can end with credit', () => {
    const invoices = listInvoices(card, all, TODAY);

    // Dezembro: 8.000 de compras − 17.000 de estornos = crédito de 9.000.
    expect(invoices.map(({ referenceMonth, total }) => [referenceMonth, total])).toEqual([
      ['2026-12', -9_000],
      ['2026-11', 25_000],
    ]);
    expect(invoices[0].refunds.map((item) => item.amount)).toEqual([2_000, 15_000]);
    expect(invoices[0].purchases.map((item) => item.id)).toEqual([november.id]);
    expect(canPayInvoice({ status: 'closed', balance: invoices[0].balance })).toBe(false);
  });

  it('lists the invoice of a refund even without purchases in it', () => {
    const late = refund(october, 1_000, '2027-01-10');

    expect(listInvoices(card, [october, late], TODAY).map((item) => item.referenceMonth)).toEqual([
      '2027-02',
      '2026-12',
      '2026-11',
    ]);
    expect(buildInvoice(card, [october, late], '2027-02', TODAY).total).toBe(-1_000);
  });

  it('lowers the budget spending in the month of the refund, never below zero', () => {
    // Novembro: 30.000 + 8.000 de despesas − 10.000 − 15.000 − 2.000 de estornos.
    expect(budgetProgress(budget, all, '2026-11')?.spent).toBe(11_000);
    // Dezembro: só o estorno de 5.000, sem despesas.
    expect(budgetProgress(budget, all, '2026-12')).toMatchObject({ spent: 0, available: 60_000 });
  });

  it('counts a refund in the budget of the refunded expense category only', () => {
    const other = transaction({ amount: 4_000, accountId: 'account', categoryId: 'transport' });

    expect(
      budgetProgress(budget, [...all, other, refund(other, 4_000, '2026-11-20')], '2026-11')?.spent,
    ).toBe(11_000);
  });

  it('counts refunds as negative expenses in the totals and in the chart', () => {
    const inNovember = all.filter((item) => item.date.startsWith('2026-11'));

    expect(summarizeTransactions(inNovember)).toEqual({
      income: 0,
      expense: 30_000 + 8_000 - 10_000 - 15_000 - 2_000,
      net: -11_000,
      pendingCount: 0,
    });
    expect(
      incomeVsExpense(all, { start: '2026-12-01', end: '2026-12-31' }).reduce(
        (total, point) => total + point.expense,
        0,
      ),
    ).toBe(-5_000);
  });
});
