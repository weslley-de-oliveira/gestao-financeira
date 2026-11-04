import { TestBed } from '@angular/core/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { InMemoryTransactionRepository } from '../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { AccountsFacade } from '../accounts/accounts.facade';
import { TransactionNotFoundError, TransactionsFacade } from './transactions.facade';
import { InvalidTransactionInputError, TransactionInput } from './domain/transaction-rules';

describe('TransactionsFacade', () => {
  let facade: TransactionsFacade;
  let repository: InMemoryTransactionRepository;
  let userId: string;

  const expense: TransactionInput = {
    type: 'expense',
    description: 'Mercado',
    amount: 25_000,
    date: '2026-11-10',
    accountId: 'account-1',
    destinationAccountId: null,
    categoryId: 'category-1',
    status: 'completed',
    notes: null,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(TransactionsFacade);
    repository = TestBed.inject(InMemoryTransactionRepository);
    userId = await signInTestUser();
    seedAccounts(
      userId,
      { name: 'Corrente', initialBalance: 100_000 },
      { name: 'Poupança', initialBalance: 50_000 },
      { name: 'Antiga', isArchived: true },
    );
    seedCategories(
      userId,
      { name: 'Mercado' },
      { name: 'Salário', type: 'income' },
      { name: 'Arquivada', isArchived: true },
    );
  });

  async function fieldOf(action: Promise<unknown>): Promise<string | undefined> {
    try {
      await action;
    } catch (error) {
      if (error instanceof InvalidTransactionInputError) {
        return error.field;
      }
      throw error;
    }
    return undefined;
  }

  it('creates a transaction for the current user', async () => {
    const created = await facade.create(expense);

    expect(repository.records).toEqual([expect.objectContaining({ ...expense, userId })]);
    expect(facade.transactions()).toEqual([created]);
  });

  it('validates the accounts and the category against the user data', async () => {
    expect(await fieldOf(facade.create({ ...expense, accountId: 'account-3' }))).toBe('accountId');
    expect(await fieldOf(facade.create({ ...expense, categoryId: 'category-2' }))).toBe(
      'categoryId',
    );
    expect(await fieldOf(facade.create({ ...expense, categoryId: 'category-3' }))).toBe(
      'categoryId',
    );
    expect(
      await fieldOf(
        facade.create({
          ...expense,
          type: 'transfer',
          categoryId: null,
          destinationAccountId: 'account-1',
        }),
      ),
    ).toBe('destinationAccountId');
    expect(repository.records).toHaveLength(0);
  });

  it('updates the account balances, ignoring pending transactions', async () => {
    const accounts = TestBed.inject(AccountsFacade);
    await facade.create(expense);
    await facade.create({
      ...expense,
      type: 'transfer',
      description: 'Reserva',
      amount: 30_000,
      categoryId: null,
      destinationAccountId: 'account-2',
    });
    const pending = await facade.create({ ...expense, amount: 99_999, status: 'pending' });

    await accounts.load();
    expect(accounts.accounts().map((a) => a.currentBalance)).toEqual([45_000, 80_000, 0]);
    expect(accounts.totalActiveBalance()).toBe(125_000);

    await facade.setStatus(pending.id, 'completed');
    expect((await accounts.getById('account-1'))?.currentBalance).toBe(-54_999);
  });

  it('keeps archived references the transaction already had when editing', async () => {
    const [old] = seedTransactions(userId, { accountId: 'account-3', categoryId: 'category-3' });

    const updated = await facade.update(old.id, {
      ...expense,
      accountId: 'account-3',
      categoryId: 'category-3',
      description: 'Editada',
    });

    expect(updated).toMatchObject({ description: 'Editada', accountId: 'account-3' });
  });

  it('deletes a transaction and recalculates the balance', async () => {
    const accounts = TestBed.inject(AccountsFacade);
    const created = await facade.create(expense);

    await facade.delete(created.id);

    expect(repository.records).toHaveLength(0);
    expect(facade.transactions()).toEqual([]);
    expect((await accounts.getById('account-1'))?.currentBalance).toBe(100_000);
  });

  it('does not touch transactions of other users', async () => {
    seedTransactions('someone-else', { id: 'other' });

    await expect(facade.delete('other')).rejects.toBeInstanceOf(TransactionNotFoundError);
    await facade.load();
    expect(facade.transactions()).toEqual([]);
  });
});
