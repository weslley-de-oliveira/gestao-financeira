import { TestBed } from '@angular/core/testing';
import { signInTestUser } from '../../../../testing/auth-fixtures';
import { InMemoryTransactionRepository } from '../../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { seedTransactions } from '../../../../testing/transaction-fixtures';
import { TransactionListStore } from './transaction-list-store';

describe('TransactionListStore', () => {
  let store: TransactionListStore;
  let repository: InMemoryTransactionRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, TransactionListStore] });
    const userId = await signInTestUser();
    repository = TestBed.inject(InMemoryTransactionRepository);
    // Mais recentes primeiro: T5, T4, ..., T1.
    seedTransactions(
      userId,
      { description: 'T1', date: '2026-11-01', amount: 1_000 },
      { description: 'T2', date: '2026-11-02', amount: 5_000 },
      { description: 'T3', date: '2026-11-03', amount: 2_000, status: 'pending' },
      { description: 'T4', date: '2026-11-04', amount: 4_000, type: 'income' },
      { description: 'T5', date: '2026-11-05', amount: 3_000 },
    );
    store = TestBed.inject(TransactionListStore);
  });

  const descriptions = () => store.items().map((item) => item.description);

  it('loads the first page with the totals of the whole filtered result', async () => {
    expect(store.status()).toBe('loading');

    await store.searchFor({}, 'date-desc', 2);

    expect(store.status()).toBe('ready');
    expect(descriptions()).toEqual(['T5', 'T4']);
    expect(store.pageIndex()).toBe(0);
    expect(store.hasAny()).toBe(true);
    expect(store.totals()).toEqual({
      count: 5,
      income: 4_000,
      expense: 9_000,
      net: -5_000,
      pendingCount: 1,
    });
  });

  it('moves forward with the cursor and back to the pages already visited', async () => {
    await store.searchFor({}, 'amount-desc', 2);

    await store.goTo(1);
    expect(descriptions()).toEqual(['T5', 'T3']);
    await store.goTo(2);
    expect(descriptions()).toEqual(['T1']);
    await store.goTo(1);
    expect(descriptions()).toEqual(['T5', 'T3']);
    await store.goTo(0);
    expect(descriptions()).toEqual(['T2', 'T4']);
  });

  it('asks for the totals again only when the filters change', async () => {
    const summarize = vi.spyOn(repository, 'summarize');
    await store.searchFor({}, 'date-desc', 2);
    summarize.mockClear();

    await store.searchFor({}, 'amount-asc', 2);
    await store.goTo(1);
    expect(summarize).not.toHaveBeenCalled();

    await store.searchFor({ type: 'expense' }, 'amount-asc', 2);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(store.pageIndex()).toBe(0);
    expect(store.totals().count).toBe(4);
  });

  it('after a deletion, refreshes the page and goes back when it became empty', async () => {
    await store.searchFor({}, 'date-desc', 2);
    await store.goTo(1);
    await store.goTo(2);
    expect(descriptions()).toEqual(['T1']);

    repository.records.splice(
      repository.records.findIndex((record) => record.description === 'T1'),
      1,
    );
    await store.refresh();

    expect(store.pageIndex()).toBe(1);
    expect(descriptions()).toEqual(['T3', 'T2']);
    expect(store.totals().count).toBe(4);
  });

  it('knows when there is no transaction at all, whatever the filters', async () => {
    repository.records.splice(0);

    await store.searchFor({ type: 'income' }, 'date-desc', 10);

    expect(store.hasAny()).toBe(false);
    expect(store.totals().count).toBe(0);
  });

  it('reports an error when the repository fails', async () => {
    vi.spyOn(repository, 'query').mockImplementation(() => {
      throw new Error('offline');
    });

    await store.searchFor({}, 'date-desc', 10);

    expect(store.status()).toBe('error');
    expect(store.busy()).toBe(false);
  });
});
