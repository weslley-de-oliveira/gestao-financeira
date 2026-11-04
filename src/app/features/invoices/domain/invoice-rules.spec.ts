import { Transaction } from '../../../shared/models/transaction';
import {
  buildInvoice,
  canPayInvoice,
  invoiceStatus,
  isInvoicePaidFor,
  listInvoices,
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
      payment: null,
    });
    expect(invoice.purchases.map((p) => p.description)).toEqual(['Farmácia', 'Sapato']);
  });

  it('derives the status from the dates and the payment', () => {
    const cycle = { closingDate: '2026-11-05', dueDate: '2026-11-12' };

    expect(invoiceStatus(cycle, null, '2026-11-04')).toBe('open');
    expect(invoiceStatus(cycle, null, '2026-11-05')).toBe('closed');
    expect(invoiceStatus(cycle, null, '2026-11-12')).toBe('closed');
    expect(invoiceStatus(cycle, null, '2026-11-13')).toBe('overdue');
    expect(invoiceStatus(cycle, payment, '2026-11-13')).toBe('paid');
    expect(invoiceStatus(cycle, payment, '2026-11-01')).toBe('paid');
  });

  it('lists the open invoice and every invoice with purchases or payment, newest first', () => {
    const invoices = listInvoices(card, [...transactions, payment], '2026-11-15');

    expect(invoices.map((i) => [i.referenceMonth, i.status, i.total])).toEqual([
      ['2026-12', 'open', 9_990],
      ['2026-11', 'paid', 35_050],
    ]);
    expect(listInvoices(card, [], '2026-11-15').map((i) => i.referenceMonth)).toEqual(['2026-12']);
  });

  it('pays only closed or overdue invoices with purchases', () => {
    expect(canPayInvoice({ status: 'closed', total: 100 })).toBe(true);
    expect(canPayInvoice({ status: 'overdue', total: 100 })).toBe(true);
    expect(canPayInvoice({ status: 'open', total: 100 })).toBe(false);
    expect(canPayInvoice({ status: 'paid', total: 100 })).toBe(false);
    expect(canPayInvoice({ status: 'closed', total: 0 })).toBe(false);
  });

  it('knows whether the invoice of a purchase date is paid', () => {
    const all = [...transactions, payment];

    expect(isInvoicePaidFor(card, all, '2026-10-20')).toBe(true);
    expect(isInvoicePaidFor(card, all, '2026-11-05')).toBe(false);
    expect(isInvoicePaidFor({ ...card, id: 'other' }, all, '2026-10-20')).toBe(false);
  });
});
