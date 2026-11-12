import { Account } from '../../shared/models/account';
import { CreditCard } from '../../shared/models/credit-card';
import { Transaction } from '../../shared/models/transaction';
import { TransactionLookups, accountLabel } from './transaction-display';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'transaction-1',
  userId: 'user-1',
  type: 'expense',
  description: 'Mercado',
  amount: 1_000,
  date: '2026-11-10',
  accountId: 'account-1',
  creditCardId: null,
  invoiceMonth: null,
  destinationAccountId: null,
  categoryId: 'category-1',
  status: 'completed',
  notes: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  ...overrides,
});

const lookups = (cardName: string): TransactionLookups => ({
  accounts: new Map([
    ['account-1', { id: 'account-1', name: 'Corrente' } as Account],
    ['account-2', { id: 'account-2', name: 'Poupança' } as Account],
  ]),
  categories: new Map(),
  creditCards: new Map([['card-1', { id: 'card-1', name: cardName } as CreditCard]]),
});

const cardPurchase = transaction({
  accountId: null,
  creditCardId: 'card-1',
  invoiceMonth: '2026-12',
});

describe('accountLabel', () => {
  it('shows the account, or both accounts of a transfer', () => {
    expect(accountLabel(transaction({}), lookups('Nubank'))).toBe('Corrente');
    expect(
      accountLabel(
        transaction({ type: 'transfer', categoryId: null, destinationAccountId: 'account-2' }),
        lookups('Nubank'),
      ),
    ).toBe('Corrente → Poupança');
  });

  it('prefixes card purchases with "Cartão"', () => {
    expect(accountLabel(cardPurchase, lookups('Nubank'))).toBe('Cartão Nubank');
  });

  it('does not repeat "Cartão" when the card name already starts with it', () => {
    expect(accountLabel(cardPurchase, lookups('Cartão principal'))).toBe('Cartão principal');
    expect(accountLabel(cardPurchase, lookups('cartao viagens'))).toBe('cartao viagens');
  });

  it('shows the invoice of an invoice payment', () => {
    const payment = transaction({
      type: 'invoice-payment',
      categoryId: null,
      creditCardId: 'card-1',
      invoiceMonth: '2026-11',
    });
    expect(accountLabel(payment, lookups('Cartão principal'))).toBe(
      'Corrente → Fatura Cartão principal',
    );
  });
});
