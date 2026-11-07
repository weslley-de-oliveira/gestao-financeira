import { TestBed } from '@angular/core/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { seedCreditCards } from '../../../testing/credit-card-fixtures';
import { InMemoryTransactionRepository } from '../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { CreditCardsFacade } from '../credit-cards/credit-cards.facade';
import { InvoicesFacade } from '../invoices/invoices.facade';
import { PaidInvoiceError } from '../invoices/domain/invoice-rules';
import { RefundsFacade } from '../refunds/refunds.facade';
import { InvalidTransactionInputError } from '../transactions/domain/transaction-rules';
import { TransactionsFacade } from '../transactions/transactions.facade';
import { InstallmentNotEditableError, InstallmentPurchaseInput } from './domain/installment-rules';
import {
  InstallmentPurchasesFacade,
  InvalidInstallmentCountError,
} from './installment-purchases.facade';

describe('InstallmentPurchasesFacade', () => {
  let facade: InstallmentPurchasesFacade;
  let userId: string;

  // Hoje: 15/11/2026. O cartão fecha dia 5 e vence dia 12.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(InstallmentPurchasesFacade);
    userId = await signInTestUser();
    seedAccounts(userId, { name: 'Corrente', initialBalance: 100_000 });
    seedCreditCards(userId, { name: 'Roxinho' }, { name: 'Antigo', isArchived: true });
    seedCategories(userId, { name: 'Casa' }, { name: 'Salário', type: 'income' });
  });

  const input: InstallmentPurchaseInput = {
    description: '  Geladeira  nova ',
    amount: 10_000,
    date: '2026-11-10',
    creditCardId: 'card-1',
    categoryId: 'category-1',
    installmentCount: 3,
    notes: '  ',
  };

  function records() {
    return TestBed.inject(InMemoryTransactionRepository).records;
  }

  it('records one card purchase per invoice, with the remainder on the first', async () => {
    const purchase = await facade.create(input);

    expect(purchase).toMatchObject({
      description: 'Geladeira nova',
      amount: 10_000,
      installmentCount: 3,
      notes: null,
    });
    expect(
      records().map(({ installmentNumber, amount, date, creditCardId, accountId, status }) => [
        installmentNumber,
        amount,
        date,
        creditCardId,
        accountId,
        status,
      ]),
    ).toEqual([
      [1, 3_334, '2026-11-10', 'card-1', null, 'completed'],
      [2, 3_333, '2026-12-10', 'card-1', null, 'completed'],
      [3, 3_333, '2027-01-10', 'card-1', null, 'completed'],
    ]);
    expect(records().every((record) => record.installmentGroupId === purchase.id)).toBe(true);
  });

  it('tells what can be anticipated and cancelled today, minus the refunds', async () => {
    // Parcelas em 10/11 (fatura atual, de 12/2026), 10/12 e 10/01 (faturas futuras).
    const purchase = await facade.create(input);

    expect(purchase).toMatchObject({
      anticipatableCount: 2,
      cancellable: { count: 3, amount: 10_000 },
    });

    await TestBed.inject(RefundsFacade).create(purchase.installments[2], {
      description: 'Desconto',
      amount: 1_000,
      date: '2027-01-10',
      notes: null,
    });

    expect(await facade.getById(purchase.id)).toMatchObject({
      anticipatableCount: 1,
      cancellable: { count: 3, amount: 9_000 },
    });
  });

  it('holds the whole amount in the card limit', async () => {
    await facade.create(input);
    const cards = TestBed.inject(CreditCardsFacade);

    await cards.load();

    expect(cards.cards().find((card) => card.id === 'card-1')?.usedLimit).toBe(10_000);
  });

  it.each([
    ['one installment', { installmentCount: 1 }],
    ['25 installments', { installmentCount: 25 }],
    ['less than 1 cent each', { amount: 2 }],
  ])('refuses %s', async (_case, overrides) => {
    await expect(facade.create({ ...input, ...overrides })).rejects.toBeInstanceOf(
      InvalidInstallmentCountError,
    );
    expect(records()).toEqual([]);
  });

  it.each([
    ['an archived card', { creditCardId: 'card-2' }, 'creditCardId'],
    ['an income category', { categoryId: 'category-2' }, 'categoryId'],
  ])('refuses %s', async (_case, overrides, field) => {
    const error = await facade.create({ ...input, ...overrides }).catch((reason) => reason);

    expect(error).toBeInstanceOf(InvalidTransactionInputError);
    expect(error).toMatchObject({ field });
  });

  it('refuses a purchase with an installment on a paid invoice', async () => {
    seedTransactions(userId, {
      accountId: null,
      creditCardId: 'card-1',
      categoryId: 'category-1',
      date: '2026-10-20',
    });
    await TestBed.inject(InvoicesFacade).pay('card-1', '2026-11');

    await expect(facade.create({ ...input, date: '2026-10-25' })).rejects.toBeInstanceOf(
      PaidInvoiceError,
    );
  });

  it('changes description, category and notes of every installment', async () => {
    const purchase = await facade.create(input);
    seedCategories(userId, { name: 'Eletrodomésticos' });

    const updated = await facade.update(purchase.id, {
      description: ' Geladeira  duplex ',
      categoryId: 'category-3',
      notes: ' Entrega em casa ',
    });

    expect(
      updated.installments.map((item) => [item.description, item.categoryId, item.notes]),
    ).toEqual(
      Array.from({ length: 3 }, () => ['Geladeira duplex', 'category-3', 'Entrega em casa']),
    );
    expect(updated.installments.map((item) => item.amount)).toEqual([3_334, 3_333, 3_333]);
  });

  it('deletes every installment, unless one is on a paid invoice', async () => {
    const open = await facade.create(input);
    await facade.delete(open.id);
    expect(records()).toEqual([]);

    const paid = await facade.create({ ...input, date: '2026-10-25' });
    await TestBed.inject(InvoicesFacade).pay('card-1', '2026-11');

    await expect(facade.delete(paid.id)).rejects.toBeInstanceOf(PaidInvoiceError);
    expect(records().filter((record) => record.installmentGroupId === paid.id)).toHaveLength(3);
  });

  it('does not let an installment change or be deleted alone', async () => {
    const purchase = await facade.create(input);
    const transactions = TestBed.inject(TransactionsFacade);
    const [first] = purchase.installments;

    await expect(transactions.delete(first.id)).rejects.toBeInstanceOf(InstallmentNotEditableError);
    await expect(transactions.setStatus(first.id, 'pending')).rejects.toBeInstanceOf(
      InstallmentNotEditableError,
    );
  });

  it('does not find purchases of other users', async () => {
    const purchase = await facade.create(input);
    records().forEach((record) => (record.userId = 'someone-else'));

    expect(await facade.getById(purchase.id)).toBeNull();
  });
});
