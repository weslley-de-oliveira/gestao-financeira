import { TestBed } from '@angular/core/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { InMemoryCreditCardRepository } from '../../../testing/in-memory-credit-card.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { CreditCardNotFoundError, CreditCardsFacade } from './credit-cards.facade';
import { CreditCardInput, InvalidCreditCardInputError } from './domain/credit-card-input';

describe('CreditCardsFacade', () => {
  let facade: CreditCardsFacade;
  let repository: InMemoryCreditCardRepository;
  let userId: string;

  const input: CreditCardInput = {
    name: ' Roxinho ',
    brand: 'mastercard',
    lastFourDigits: '4321',
    creditLimit: 300_000,
    closingDay: 5,
    dueDay: 12,
    paymentAccountId: 'account-1',
    color: '#6a1b9a',
    isArchived: false,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(CreditCardsFacade);
    repository = TestBed.inject(InMemoryCreditCardRepository);
    userId = await signInTestUser();
    seedAccounts(userId, { name: 'Corrente' }, { name: 'Antiga', isArchived: true });
  });

  it('creates a card with normalized data and no stored usage', async () => {
    const created = await facade.create(input);

    expect(repository.records).toEqual([
      expect.objectContaining({ userId, name: 'Roxinho', lastFourDigits: '4321' }),
    ]);
    expect(repository.records[0]).not.toHaveProperty('usedLimit');
    expect(created).toMatchObject({ usedLimit: 0, availableLimit: 300_000 });
  });

  it('computes the usage from the card purchases (today is 15/11/2026)', async () => {
    const { id } = await facade.create(input);
    seedTransactions(
      userId,
      { accountId: null, creditCardId: id, amount: 50_000, date: '2026-11-02' },
      { accountId: null, creditCardId: id, amount: 12_345, date: '2026-11-10' },
      { amount: 99_999 },
    );

    await facade.load();

    expect(facade.cards()[0]).toMatchObject({
      usedLimit: 62_345,
      availableLimit: 237_655,
      nextInvoice: { closingDate: '2026-12-05', dueDate: '2026-12-12', amount: 12_345 },
    });
  });

  it('uses the usage computed by the server, without loading the transactions', async () => {
    await facade.create(input);
    const nextInvoice = {
      referenceMonth: '2026-12',
      start: '2026-11-05',
      end: '2026-12-04',
      closingDate: '2026-12-05',
      dueDate: '2026-12-12',
      amount: 1_000,
    };
    repository.records[0].usage = { usedLimit: 40_000, availableLimit: 260_000, nextInvoice };
    const listTransactions = vi.spyOn(TestBed.inject(TransactionRepository), 'listByUser');

    await facade.load();

    expect(facade.cards()[0]).toMatchObject({ usedLimit: 40_000, nextInvoice });
    expect(facade.cards()[0]).not.toHaveProperty('usage');
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it('requires an active payment account of the user', async () => {
    for (const paymentAccountId of ['account-2', 'unknown']) {
      await expect(facade.create({ ...input, paymentAccountId })).rejects.toMatchObject({
        field: 'paymentAccountId',
      });
    }
    expect(repository.records).toHaveLength(0);
  });

  it('keeps the archived payment account the card already had when editing', async () => {
    const { id } = await facade.create(input);
    repository.records[0].paymentAccountId = 'account-2';

    await expect(
      facade.update(id, { ...input, paymentAccountId: 'account-2', name: 'Renomeado' }),
    ).resolves.toMatchObject({ name: 'Renomeado' });
  });

  it('rejects invalid data before persisting', async () => {
    await expect(
      facade.create({ ...input, lastFourDigits: '4111111111111111' }),
    ).rejects.toBeInstanceOf(InvalidCreditCardInputError);
    expect(repository.records).toHaveLength(0);
  });

  it('archives and restores a card keeping its data', async () => {
    const { id } = await facade.create(input);

    await facade.setArchived(id, true);
    expect(repository.records[0]).toMatchObject({ isArchived: true, creditLimit: 300_000 });

    await facade.setArchived(id, false);
    expect(repository.records[0].isArchived).toBe(false);
  });

  it('does not expose or change cards of other users', async () => {
    await facade.create(input);
    repository.records.push({ ...repository.records[0], id: 'other', userId: 'someone-else' });

    await facade.load();

    expect(facade.cards()).toHaveLength(1);
    expect(await facade.getById('other')).toBeNull();
    await expect(facade.setArchived('other', true)).rejects.toBeInstanceOf(CreditCardNotFoundError);
  });
});
