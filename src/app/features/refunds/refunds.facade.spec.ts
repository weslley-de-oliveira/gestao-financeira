import { TestBed } from '@angular/core/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { seedCreditCards } from '../../../testing/credit-card-fixtures';
import { InMemoryTransactionRepository } from '../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { Transaction } from '../../shared/models/transaction';
import { InstallmentPurchasesFacade } from '../installments/installment-purchases.facade';
import { PaidInvoiceError } from '../invoices/domain/invoice-rules';
import { TransactionsFacade } from '../transactions/transactions.facade';
import {
  HasRefundsError,
  InvalidRefundInputError,
  NotRefundableError,
  RefundInput,
} from './domain/refund-rules';
import { RefundsFacade } from './refunds.facade';

describe('RefundsFacade', () => {
  let facade: RefundsFacade;
  let transactions: TransactionsFacade;
  let userId: string;
  let expense: Transaction;
  let purchase: Transaction;

  const refund = (overrides: Partial<RefundInput> = {}): RefundInput => ({
    description: 'Estorno: Mercado',
    amount: 10_000,
    date: '2026-11-03',
    notes: null,
    ...overrides,
  });

  // Hoje: 15/11/2026. O cartão fecha dia 5 e vence dia 12; a fatura de novembro está paga.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(RefundsFacade);
    transactions = TestBed.inject(TransactionsFacade);
    userId = await signInTestUser();
    seedAccounts(userId, { name: 'Corrente', initialBalance: 100_000 });
    seedCreditCards(userId, { name: 'Roxinho' });
    seedCategories(userId, { name: 'Mercado' }, { name: 'Salário', type: 'income' });
    [expense, purchase] = seedTransactions(
      userId,
      { description: 'Mercado', amount: 30_000, date: '2026-11-02' },
      { amount: 25_000, date: '2026-10-20', accountId: null, creditCardId: 'card-1' },
      {
        type: 'invoice-payment',
        amount: 25_000,
        date: '2026-11-12',
        creditCardId: 'card-1',
        invoiceMonth: '2026-11',
        categoryId: null,
      },
    );
  });

  async function errorOf(action: Promise<unknown>): Promise<unknown> {
    return action.then(
      () => undefined,
      (error: unknown) => error,
    );
  }

  it('records the refund in the account of the expense, linked to it', async () => {
    const created = await facade.create(expense, refund({ description: '  Estorno:  Mercado ' }));

    expect(created).toMatchObject({
      userId,
      type: 'refund',
      description: 'Estorno: Mercado',
      amount: 10_000,
      date: '2026-11-03',
      accountId: 'account-1',
      creditCardId: null,
      categoryId: null,
      status: 'completed',
      refundedTransactionId: expense.id,
    });
    expect(await facade.listFor(expense.id)).toEqual([created]);
  });

  it('refunds up to the amount still not refunded, never before the expense', async () => {
    await facade.create(expense, refund({ amount: 20_000 }));

    const tooMuch = await errorOf(facade.create(expense, refund({ amount: 10_001 })));
    expect(tooMuch).toBeInstanceOf(InvalidRefundInputError);
    expect(tooMuch).toMatchObject({ field: 'amount' });
    expect(await errorOf(facade.create(expense, refund({ date: '2026-11-01' })))).toMatchObject({
      field: 'date',
    });
    await expect(facade.create(expense, refund({ amount: 10_000 }))).resolves.toBeDefined();
  });

  it('refunds only completed expenses', async () => {
    const [pending, income] = seedTransactions(
      userId,
      { status: 'pending' },
      { type: 'income', categoryId: 'category-2' },
    );

    await expect(facade.create(pending, refund())).rejects.toBeInstanceOf(NotRefundableError);
    await expect(facade.create(income, refund())).rejects.toBeInstanceOf(NotRefundableError);
  });

  it('refuses a card refund in a paid invoice, and accepts it in the open one', async () => {
    await expect(facade.create(purchase, refund({ date: '2026-11-01' }))).rejects.toBeInstanceOf(
      PaidInvoiceError,
    );

    const created = await facade.create(purchase, refund({ date: '2026-11-10' }));
    expect(created).toMatchObject({ accountId: null, creditCardId: 'card-1' });
  });

  it('edits a refund up to what is left without counting itself', async () => {
    const first = await facade.create(expense, refund({ amount: 10_000 }));
    await facade.create(expense, refund({ amount: 15_000 }));

    const updated = await facade.update(first, refund({ amount: 15_000, date: '2026-11-04' }));
    expect(updated).toMatchObject({ amount: 15_000, date: '2026-11-04', type: 'refund' });
    expect(await errorOf(facade.update(updated, refund({ amount: 15_001 })))).toMatchObject({
      field: 'amount',
    });
  });

  it('keeps the expense while it has refunds, except for description, category and notes', async () => {
    const created = await facade.create(expense, refund());
    const repository = TestBed.inject(TransactionRepository);
    const update = vi.spyOn(repository, 'update');
    const input = {
      type: 'expense' as const,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      accountId: expense.accountId,
      creditCardId: null,
      destinationAccountId: null,
      categoryId: expense.categoryId,
      status: expense.status,
      notes: null,
    };

    await transactions.update(expense.id, { ...input, description: 'Feira', notes: 'Sábado' });
    expect(update).toHaveBeenLastCalledWith(
      expense.id,
      { description: 'Feira', notes: 'Sábado' },
      undefined,
    );
    await expect(
      transactions.update(expense.id, { ...input, amount: 1_000 }),
    ).rejects.toBeInstanceOf(HasRefundsError);
    await expect(transactions.setStatus(expense.id, 'pending')).rejects.toBeInstanceOf(
      HasRefundsError,
    );
    await expect(transactions.delete(expense.id)).rejects.toBeInstanceOf(HasRefundsError);

    await transactions.delete(created.id);
    await transactions.delete(expense.id);
    expect(TestBed.inject(InMemoryTransactionRepository).records).toHaveLength(2);
  });

  it('keeps a refund of a paid invoice, and an installment purchase with refunds', async () => {
    const installments = TestBed.inject(InstallmentPurchasesFacade);
    const bought = await installments.create({
      description: 'Geladeira',
      amount: 30_000,
      date: '2026-11-10',
      creditCardId: 'card-1',
      categoryId: 'category-1',
      installmentCount: 3,
      notes: null,
    });
    await facade.create(bought.installments[2], refund({ date: '2027-01-10' }));

    await expect(installments.delete(bought.id)).rejects.toBeInstanceOf(HasRefundsError);

    const [paidRefund] = seedTransactions(userId, {
      type: 'refund',
      date: '2026-11-01',
      accountId: null,
      creditCardId: 'card-1',
      categoryId: null,
      refundedTransactionId: purchase.id,
    });
    await expect(transactions.delete(paidRefund.id)).rejects.toBeInstanceOf(PaidInvoiceError);
  });
});
