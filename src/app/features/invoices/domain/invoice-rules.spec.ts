import { Transaction } from '../../../shared/models/transaction';
import {
  buildInvoice,
  canPayInvoice,
  invoiceStatus,
  isInvoicePaidFor,
  listInvoices,
  toInvoiceSummary,
} from './invoice-rules';

const card = { id: 'card', closingDay: 5, dueDay: 12 };

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.description ?? 'id',
    userId: 'user',
    type: 'expense',
    description: 'Compra',
    amount: 1_000,
    date: '2026-11-10',
    accountId: null,
    creditCardId: 'card',
    invoiceMonth: null,
    destinationAccountId: null,
    categoryId: 'food',
    status: 'completed',
    notes: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

const transactions = [
  transaction({ description: 'Sapato', amount: 20_000, date: '2026-10-20' }),
  transaction({ description: 'Farmácia', amount: 15_050, date: '2026-11-04' }),
  transaction({ description: 'Notebook', amount: 9_990, date: '2026-11-05' }),
  transaction({ description: 'Outro cartão', creditCardId: 'other', date: '2026-11-01' }),
  transaction({ description: 'Na conta', creditCardId: null, accountId: 'checking' }),
];

const payment = transaction({
  description: 'Fatura',
  type: 'invoice-payment',
  amount: 35_050,
  date: '2026-11-10',
  accountId: 'checking',
  invoiceMonth: '2026-11',
  categoryId: null,
});

describe('invoice rules', () => {
  it('groups the purchases of the cycle and sums the total', () => {
    const invoice = buildInvoice(card, transactions, '2026-11', '2026-11-15');

    expect(invoice).toMatchObject({
      referenceMonth: '2026-11',
      start: '2026-10-05',
      end: '2026-11-04',
      closingDate: '2026-11-05',
      dueDate: '2026-11-12',
      total: 35_050,
      previousBalance: 0,
      amountDue: 35_050,
      paidAmount: 0,
      balance: 35_050,
      payments: [],
      payment: null,
    });
    expect(invoice.purchases.map((p) => p.description)).toEqual(['Farmácia', 'Sapato']);
  });

  it('derives the status from the dates and the balance', () => {
    const cycle = { closingDate: '2026-11-05', dueDate: '2026-11-12' };
    const nextClosing = '2026-12-05';

    expect(invoiceStatus(cycle, 100, nextClosing, '2026-11-04')).toBe('open');
    expect(invoiceStatus(cycle, 0, nextClosing, '2026-11-04')).toBe('open');
    expect(invoiceStatus(cycle, 100, nextClosing, '2026-11-05')).toBe('closed');
    expect(invoiceStatus(cycle, 100, nextClosing, '2026-11-12')).toBe('closed');
    expect(invoiceStatus(cycle, 100, nextClosing, '2026-11-13')).toBe('overdue');
    expect(invoiceStatus(cycle, 100, nextClosing, '2026-12-04')).toBe('overdue');
    expect(invoiceStatus(cycle, 100, nextClosing, '2026-12-05')).toBe('carried-over');
    expect(invoiceStatus(cycle, 0, nextClosing, '2026-11-13')).toBe('paid');
    expect(invoiceStatus(cycle, -500, nextClosing, '2026-12-05')).toBe('paid');
  });

  it('lists the open invoice and every invoice with purchases or payment, newest first', () => {
    const invoices = listInvoices(card, [...transactions, payment], '2026-11-15');

    expect(invoices.map((i) => [i.referenceMonth, i.status, i.total])).toEqual([
      ['2026-12', 'open', 9_990],
      ['2026-11', 'paid', 35_050],
    ]);
    expect(listInvoices(card, [], '2026-11-15').map((i) => i.referenceMonth)).toEqual(['2026-12']);
  });

  it('pays only closed or overdue invoices with a balance', () => {
    expect(canPayInvoice({ status: 'closed', balance: 100 })).toBe(true);
    expect(canPayInvoice({ status: 'overdue', balance: 100 })).toBe(true);
    expect(canPayInvoice({ status: 'open', balance: 100 })).toBe(false);
    expect(canPayInvoice({ status: 'carried-over', balance: 100 })).toBe(false);
    expect(canPayInvoice({ status: 'closed', balance: 0 })).toBe(false);
  });

  it('locks purchases of a paid invoice and of every invoice before it', () => {
    const all = [...transactions, payment];

    expect(isInvoicePaidFor(card, all, '2026-10-20')).toBe(true);
    // A fatura de 10/2026 é anterior à paga: o saldo dela entraria na de 11/2026.
    expect(isInvoicePaidFor(card, all, '2026-09-20')).toBe(true);
    expect(isInvoicePaidFor(card, all, '2026-11-05')).toBe(false);
    expect(isInvoicePaidFor({ ...card, id: 'other' }, all, '2026-10-20')).toBe(false);
  });

  it('summarizes an invoice without the purchases, refunds and payments', () => {
    const summary = toInvoiceSummary(
      buildInvoice(card, [...transactions, payment], '2026-11', '2026-11-15'),
    );

    expect(summary).toMatchObject({ status: 'paid', paidAmount: 35_050, purchaseCount: 2 });
    expect(summary).not.toHaveProperty('purchases');
    expect(summary).not.toHaveProperty('refunds');
    expect(summary).not.toHaveProperty('payments');
  });
});

describe('balance between invoices', () => {
  // 2026-11: compras de 05/10 a 04/11, fecha 05/11, vence 12/11 (35.050).
  // 2026-12: compras de 05/11 a 04/12, fecha 05/12, vence 12/12 (9.990).
  const partial = (amount: number, date: string, invoiceMonth = '2026-11') =>
    transaction({
      description: 'Fatura',
      type: 'invoice-payment',
      amount,
      date,
      accountId: 'checking',
      invoiceMonth,
      categoryId: null,
    });

  it('pays in parts: sums the payments and shows what is left', () => {
    const first = partial(20_000, '2026-11-10');
    const second = partial(5_000, '2026-11-11');
    const invoice = buildInvoice(card, [...transactions, first, second], '2026-11', '2026-11-12');

    expect(invoice).toMatchObject({
      amountDue: 35_050,
      paidAmount: 25_000,
      balance: 10_050,
      status: 'closed',
      payment: second,
    });
    expect(invoice.payments).toEqual([second, first]);
    expect(canPayInvoice(invoice)).toBe(true);
  });

  it('an invoice paid in full, in parts, is paid', () => {
    const all = [...transactions, partial(20_000, '2026-11-10'), partial(15_050, '2026-11-11')];

    expect(buildInvoice(card, all, '2026-11', '2026-11-15')).toMatchObject({
      balance: 0,
      status: 'paid',
    });
  });

  it('carries the balance over only when the next invoice closes', () => {
    const all = [...transactions, partial(20_000, '2026-11-10')];

    const beforeClosing = listInvoices(card, all, '2026-12-04');
    expect(beforeClosing.map((i) => [i.referenceMonth, i.status, i.previousBalance])).toEqual([
      ['2026-12', 'open', 0],
      ['2026-11', 'overdue', 0],
    ]);

    const [, december, november] = listInvoices(card, all, '2026-12-05');
    expect(november).toMatchObject({ status: 'carried-over', balance: 15_050 });
    expect(december).toMatchObject({
      status: 'closed',
      total: 9_990,
      previousBalance: 15_050,
      amountDue: 25_040,
      balance: 25_040,
    });
  });

  it('a late payment, before the next closing, leaves no balance', () => {
    const all = [...transactions, partial(20_000, '2026-11-10'), partial(15_050, '2026-12-01')];

    const [, december, november] = listInvoices(card, all, '2026-12-05');
    expect(november).toMatchObject({ status: 'paid', balance: 0 });
    expect(december).toMatchObject({ previousBalance: 0, amountDue: 9_990 });
  });

  it('carries over the credit of an invoice with more refunds than purchases', () => {
    const refund = transaction({
      description: 'Estorno',
      type: 'refund',
      amount: 50_000,
      date: '2026-11-20',
      refundedTransactionId: 'id-001',
    });
    const all = [...transactions, partial(35_050, '2026-11-10'), refund];

    const [, january, december] = listInvoices(card, all, '2027-01-05');
    expect(december).toMatchObject({ total: -40_010, balance: -40_010, status: 'paid' });
    // Sem compras, a fatura de 01/2027 aparece pelo saldo anterior.
    expect(january).toMatchObject({
      referenceMonth: '2027-01',
      previousBalance: -40_010,
      amountDue: -40_010,
      status: 'paid',
    });
  });

  it('carries the balance through a month without purchases', () => {
    const invoices = listInvoices(card, transactions, '2027-01-05');

    expect(invoices.map((i) => [i.referenceMonth, i.status, i.previousBalance, i.balance])).toEqual(
      [
        ['2027-02', 'open', 0, 0],
        ['2027-01', 'closed', 45_040, 45_040],
        ['2026-12', 'carried-over', 35_050, 45_040],
        ['2026-11', 'carried-over', 0, 35_050],
      ],
    );
  });

  it('a month outside the chain is an empty invoice', () => {
    expect(buildInvoice(card, transactions, '2026-01', '2026-11-15')).toMatchObject({
      total: 0,
      previousBalance: 0,
      balance: 0,
      status: 'paid',
    });
  });
});
