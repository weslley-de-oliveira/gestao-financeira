import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { InMemoryAccountRepository } from '../../../testing/in-memory-account.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { AuthService } from '../../core/auth/auth.service';
import { TransactionSource } from '../../data-access/repositories/transaction-source';
import { AccountNotFoundError, AccountsFacade } from './accounts.facade';
import { AccountInput, InvalidAccountInputError } from './domain/account-input';

describe('AccountsFacade', () => {
  let facade: AccountsFacade;
  let repository: InMemoryAccountRepository;

  const input: AccountInput = {
    name: '  Conta Principal ',
    type: 'checking',
    institution: '  ',
    initialBalance: 150_075,
    color: '#1565c0',
    icon: 'account_balance',
    isArchived: false,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(AccountsFacade);
    repository = TestBed.inject(InMemoryAccountRepository);
    await TestBed.inject(AuthService).register({
      name: 'Ana Teste',
      email: 'ana@exemplo.com',
      password: 'senha123',
    });
  });

  it('creates an account for the current user with normalized data', async () => {
    const created = await facade.create(input);

    const userId = TestBed.inject(AuthService).currentUser()?.id;
    expect(repository.records).toEqual([
      expect.objectContaining({
        userId,
        name: 'Conta Principal',
        institution: null,
        initialBalance: 150_075,
      }),
    ]);
    expect(created.currentBalance).toBe(150_075);
    expect(repository.records[0]).not.toHaveProperty('currentBalance');
  });

  it('loads only the accounts of the current user', async () => {
    await facade.create(input);
    repository.records.push({ ...repository.records[0], id: 'other', userId: 'someone-else' });

    await facade.load();

    expect(facade.status()).toBe('ready');
    expect(facade.accounts().map((account) => account.name)).toEqual(['Conta Principal']);
    expect(await facade.getById('other')).toBeNull();
  });

  it('uses the balance computed by the server, without loading the transactions', async () => {
    await facade.create(input);
    repository.records[0].currentBalance = 98_765;
    const listTransactions = vi.spyOn(TestBed.inject(TransactionSource), 'listByUser');

    await facade.load();

    expect(facade.accounts()[0].currentBalance).toBe(98_765);
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it('rejects invalid or non-finite values before persisting', async () => {
    for (const initialBalance of [Number.NaN, Infinity, 10.5]) {
      await expect(facade.create({ ...input, initialBalance })).rejects.toBeInstanceOf(
        InvalidAccountInputError,
      );
    }
    await expect(facade.create({ ...input, name: '   ' })).rejects.toBeInstanceOf(
      InvalidAccountInputError,
    );
    expect(repository.records).toHaveLength(0);
  });

  it('archives and restores an account keeping its data', async () => {
    const { id } = await facade.create(input);

    await facade.setArchived(id, true);
    expect(repository.records[0]).toMatchObject({ isArchived: true, initialBalance: 150_075 });
    expect(facade.totalActiveBalance()).toBe(0);

    await facade.setArchived(id, false);
    expect(facade.totalActiveBalance()).toBe(150_075);
  });

  it('updates the account and the loaded list', async () => {
    const { id } = await facade.create(input);

    await facade.update(id, { ...input, name: 'Renomeada', initialBalance: -500 });

    expect(facade.accounts()).toEqual([
      expect.objectContaining({ id, name: 'Renomeada', currentBalance: -500 }),
    ]);
  });

  it('does not update accounts of other users', async () => {
    repository.records.push({
      ...input,
      id: 'other',
      userId: 'someone-else',
      createdAt: new Date().toISOString(),
    });

    await expect(facade.setArchived('other', true)).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(repository.records[0].isArchived).toBe(false);
  });

  it('exposes an error status when loading fails', async () => {
    vi.spyOn(repository, 'listByUser').mockReturnValue(throwError(() => new Error('offline')));

    await facade.load();

    expect(facade.status()).toBe('error');
  });
});
