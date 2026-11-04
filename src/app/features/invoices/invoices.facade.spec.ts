import { TestBed } from '@angular/core/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { seedCreditCards } from '../../../testing/credit-card-fixtures';
import { InMemoryAccountRepository } from '../../../testing/in-memory-account.repository';
import { InMemoryTransactionRepository } from '../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { AccountsFacade } from '../accounts/accounts.facade';
import { CreditCardsFacade } from '../credit-cards/credit-cards.facade';
import { summarizeTransactions } from '../transactions/domain/transaction-rules';
import { PaidInvoiceError, TransactionsFacade } from '../transactions/transactions.facade';
import { InvoicePaymentError, InvoicesFacade } from './invoices.facade';

describe('InvoicesFacade', () => {
  let facade: InvoicesFacade;
  let userId: string;

  // Hoje: 15/11/2026. Cartão fecha dia 5 e vence dia 12: a fatura 2026-11 (compras de 05/10 a
  // 04/11) está vencida e a 2026-12 está aberta.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(InvoicesFacade);
    userId = await signInTestUser();
    seedAccounts(userId, { name: 'Corrente', initialBalance: 100_000 });
    seedCreditCards(userId, { name: 'Roxinho', creditLimit: 300_000 });
    seedCategories(userId, { name: 'Compras' });
    seedTransactions(
      userId,
      {
        description: 'Sapato',
        accountId: null,
        creditCardId: 'card-1',
        amount: 20_000,
        date: '2026-10-20',
      },
      {
        description: 'Notebook',
        accountId: null,
        creditCardId: 'card-1',
        amount: 9_990,
        date: '2026-11-10',
      },
    );
  });

  function records() {
    return TestBed.inject(InMemoryTransactionRepository).records;
  }

  it('pays the full invoice from the card payment account, today', async () => {
    const payment = await facade.pay('card-1', '2026-11');

    expect(payment).toMatchObject({
      type: 'invoice-payment',
      amount: 20_000,
      date: '2026-11-15',
      accountId: 'account-1',
      creditCardId: 'card-1',
      invoiceMonth: '2026-11',
      categoryId: null,
      status: 'completed',
    });
    expect(TestBed.inject(TransactionsFacade).transactions()).toContainEqual(payment);
  });

  it('debits the account and releases the limit without counting a new expense', async () => {
    const before = summarizeTransactions(records());

    await facade.pay('card-1', '2026-11');

    expect(summarizeTransactions(records())).toEqual(before);
    const accounts = TestBed.inject(AccountsFacade);
    await accounts.load();
    expect(accounts.accounts()[0].currentBalance).toBe(80_000);
    const cards = TestBed.inject(CreditCardsFacade);
    await cards.load();
    expect(cards.cards()[0].usedLimit).toBe(9_990);
  });

  it('refuses open, empty, already paid or unknown invoices', async () => {
    await expect(facade.pay('card-1', '2026-12')).rejects.toMatchObject({ reason: 'not-payable' });
    await expect(facade.pay('card-1', '2026-10')).rejects.toMatchObject({ reason: 'not-payable' });
    await facade.pay('card-1', '2026-11');
    await expect(facade.pay('card-1', '2026-11')).rejects.toMatchObject({ reason: 'not-payable' });
    await expect(facade.pay('card-x', '2026-11')).rejects.toBeInstanceOf(InvoicePaymentError);
    await expect(facade.pay('card-1', 'invalid')).rejects.toMatchObject({ reason: 'not-found' });
    expect(records().filter((t) => t.type === 'invoice-payment')).toHaveLength(1);
  });

  it('refuses an archived payment account', async () => {
    TestBed.inject(InMemoryAccountRepository).records[0].isArchived = true;

    await expect(facade.pay('card-1', '2026-11')).rejects.toMatchObject({
      reason: 'payment-account',
    });
  });

  it('locks the purchases of a paid invoice until the payment is undone', async () => {
    await facade.pay('card-1', '2026-11');
    const transactions = TestBed.inject(TransactionsFacade);
    const sapato = records().find((t) => t.description === 'Sapato')!;

    await expect(transactions.delete(sapato.id)).rejects.toBeInstanceOf(PaidInvoiceError);
    await expect(
      transactions.create({
        type: 'expense',
        description: 'Atrasada',
        amount: 1_000,
        date: '2026-10-25',
        accountId: null,
        creditCardId: 'card-1',
        destinationAccountId: null,
        categoryId: 'category-1',
        status: 'completed',
        notes: null,
      }),
    ).rejects.toBeInstanceOf(PaidInvoiceError);

    await facade.undoPayment('card-1', '2026-11');

    expect(records().some((t) => t.type === 'invoice-payment')).toBe(false);
    await expect(transactions.delete(sapato.id)).resolves.toBeUndefined();
  });

  it('does not touch cards of other users', async () => {
    seedCreditCards('someone-else', { name: 'Alheio' });

    await expect(facade.pay('card-2', '2026-11')).rejects.toMatchObject({ reason: 'not-found' });
  });
});
