import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import seedJson from '../../../../db/db.seed.json';
import { TODAY } from '../../core/services/today';
import { Account } from '../../shared/models/account';
import { provideDataAccess } from '../data-access.providers.demo';
import { AccountRepository } from '../repositories/account.repository';
import { DemoData } from '../repositories/demo-data';
import { LocalTransactionRepository } from './local-transaction.repository';
import { UserDataRepository } from '../repositories/user-data.repository';
import { UserRepository } from '../repositories/user.repository';
import { DEMO_CREDENTIALS } from './demo-credentials';
import { DemoSeed } from './demo-seed';
import { LOCAL_DATABASE_KEY, LocalRecordNotFoundError } from './local-database';

const seed = seedJson as unknown as DemoSeed;
const demoUserId = seed.users[0].id;

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: crypto.randomUUID(),
    userId: demoUserId,
    name: 'Conta nova',
    type: 'checking',
    institution: null,
    initialBalance: 0,
    color: '#1565c0',
    icon: 'account_balance',
    isArchived: false,
    createdAt: '2026-11-05T12:00:00.000Z',
    ...overrides,
  };
}

function stored(): { version: number; collections: Record<string, { id: string }[]> } {
  return JSON.parse(localStorage.getItem(LOCAL_DATABASE_KEY) ?? 'null');
}

describe('LocalDatabase and local repositories', () => {
  let today: Date;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideDataAccess(), { provide: TODAY, useValue: () => today }],
    });
    return {
      accounts: TestBed.inject(AccountRepository),
      transactions: TestBed.inject(LocalTransactionRepository),
      users: TestBed.inject(UserRepository),
      userData: TestBed.inject(UserDataRepository),
      demoData: TestBed.inject(DemoData),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    today = new Date(2026, 10, 15);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts from the seed and saves it in localStorage', async () => {
    const { accounts } = setup();

    const list = await firstValueFrom(accounts.listByUser(demoUserId));

    expect(list.map((item) => item.name)).toEqual(seed.accounts.map((item) => item.name));
    expect(stored().collections['accounts']).toHaveLength(seed.accounts.length);
  });

  it('moves the seed dates to the current month', async () => {
    today = new Date(2027, 0, 10);
    const { transactions } = setup();

    const list = await firstValueFrom(transactions.listByUser(demoUserId));
    const latest = list
      .map((item) => item.date)
      .sort()
      .at(-1);

    // O seed vai até novembro de 2026; dois meses depois, até janeiro de 2027.
    expect(latest?.startsWith('2027-01')).toBe(true);
  });

  it('keeps changes in localStorage for the next visit', async () => {
    // O id e a data de criação são gerados ao gravar.
    const created = await firstValueFrom(setup().accounts.create(account()));

    TestBed.resetTestingModule();
    const found = await firstValueFrom(setup().accounts.findById(created.id));

    expect(found).toEqual(created);
  });

  it('discards stored data of another format version', async () => {
    localStorage.setItem(
      LOCAL_DATABASE_KEY,
      JSON.stringify({ version: 0, collections: { accounts: [] } }),
    );

    const list = await firstValueFrom(setup().accounts.listByUser(demoUserId));

    expect(list).toHaveLength(seed.accounts.length);
  });

  it('does not lose concurrent writes', async () => {
    const { accounts } = setup();
    const created = Array.from({ length: 5 }, (_, index) => account({ name: `Conta ${index}` }));

    await Promise.all(created.map((item) => firstValueFrom(accounts.create(item))));

    const list = await firstValueFrom(accounts.listByUser(demoUserId));
    expect(list).toHaveLength(seed.accounts.length + created.length);
  });

  it('updates and deletes records, failing for unknown ids', async () => {
    const { accounts, transactions } = setup();
    const [first] = seed.accounts;
    const [transaction] = seed.transactions;

    const updated = await firstValueFrom(accounts.update(first.id, { name: 'Renomeada' }));
    await firstValueFrom(transactions.delete(transaction.id));

    expect(updated.name).toBe('Renomeada');
    expect(await firstValueFrom(transactions.findById(transaction.id))).toBeNull();
    await expect(firstValueFrom(accounts.update('missing', { name: 'x' }))).rejects.toBeInstanceOf(
      LocalRecordNotFoundError,
    );
  });

  it('returns copies, so callers cannot change the stored data', async () => {
    const { accounts } = setup();
    const found = await firstValueFrom(accounts.findById(seed.accounts[0].id));
    found!.name = 'Alterada fora do repositório';

    const again = await firstValueFrom(accounts.findById(seed.accounts[0].id));

    expect(again?.name).toBe(seed.accounts[0].name);
  });

  it('keeps working in memory when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const { accounts } = setup();

    await firstValueFrom(accounts.create(account({ name: 'Só em memória' })));

    const list = await firstValueFrom(accounts.listByUser(demoUserId));
    expect(list.some((item) => item.name === 'Só em memória')).toBe(true);
    expect(localStorage.getItem(LOCAL_DATABASE_KEY)).toBeNull();
  });

  it('restores the initial data', async () => {
    const { accounts, users, demoData } = setup();
    await firstValueFrom(accounts.create(account()));
    await firstValueFrom(users.updateName(demoUserId, 'Outro nome'));

    await demoData.restoreInitialData();

    expect(await firstValueFrom(accounts.listByUser(demoUserId))).toHaveLength(
      seed.accounts.length,
    );
    expect((await firstValueFrom(users.findByEmail(DEMO_CREDENTIALS.email)))?.user.name).toBe(
      seed.users[0].name,
    );
  });

  it('finds, creates and renames users', async () => {
    const { users } = setup();
    const demo = await firstValueFrom(users.findByEmail(DEMO_CREDENTIALS.email));
    const created = await firstValueFrom(
      users.create({
        user: { id: 'new', name: 'Pessoa', email: 'teste@exemplo.com', createdAt: '' },
        passwordHash: demo!.passwordHash,
      }),
    );

    const renamed = await firstValueFrom(users.updateName('new', 'Pessoa Teste'));

    expect(demo?.user.id).toBe(demoUserId);
    expect(created.user.email).toBe('teste@exemplo.com');
    expect(renamed.name).toBe('Pessoa Teste');
    expect(await firstValueFrom(users.findByEmail('ninguem@exemplo.com'))).toBeNull();
  });

  it('deletes a user and all of their data', async () => {
    const { accounts, transactions, users, userData } = setup();

    await firstValueFrom(userData.deleteAllForUser(demoUserId));

    expect(await firstValueFrom(users.findByEmail(DEMO_CREDENTIALS.email))).toBeNull();
    expect(await firstValueFrom(accounts.listByUser(demoUserId))).toEqual([]);
    expect(await firstValueFrom(transactions.listByUser(demoUserId))).toEqual([]);
    expect(Object.values(stored().collections).every((records) => records.length === 0)).toBe(true);
  });
});
