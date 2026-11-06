import { Transaction } from '../../../shared/models/transaction';
import {
  InvalidTransactionCursorError,
  defaultTransactionQuery,
  filterTransactions,
  fromQueryParams,
  pageTransactions,
  toQueryParams,
  toTransactionFilters,
  totalTransactions,
} from './transaction-query';

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.description ?? 'id',
    userId: 'user',
    type: 'expense',
    description: 'Transação',
    amount: 10_000,
    date: '2026-11-04',
    accountId: 'checking',
    creditCardId: null,
    invoiceMonth: null,
    destinationAccountId: null,
    categoryId: 'food',
    status: 'completed',
    notes: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

// Registradas em sequência: no empate, a registrada por último vem primeiro.
const transactions = [
  transaction({ description: 'Mercado', date: '2026-11-03', amount: 30_000 }),
  transaction({
    description: 'Salário',
    type: 'income',
    categoryId: 'salary',
    date: '2026-11-05',
    amount: 500_000,
    createdAt: '2026-11-01T10:01:00.000Z',
  }),
  transaction({
    description: 'Reserva',
    type: 'transfer',
    categoryId: null,
    destinationAccountId: 'savings',
    date: '2026-11-05',
    amount: 30_000,
    createdAt: '2026-11-01T10:02:00.000Z',
  }),
  transaction({
    description: 'Aluguel',
    status: 'pending',
    notes: 'Novembro',
    date: '2026-11-10',
    createdAt: '2026-11-01T10:03:00.000Z',
  }),
  transaction({
    description: 'Farmácia',
    accountId: null,
    creditCardId: 'card',
    date: '2026-10-30',
    amount: 4_500,
    createdAt: '2026-11-01T10:04:00.000Z',
  }),
];
const november = { start: '2026-11-01', end: '2026-11-30' };
const descriptions = (items: readonly Transaction[]) => items.map((item) => item.description);

describe('transaction query', () => {
  describe('toTransactionFilters', () => {
    const isCard = (id: string) => id === 'card';

    it('leaves out the filters set to "all" and a blank search', () => {
      expect(
        toTransactionFilters({ ...defaultTransactionQuery(), search: '  ' }, null, isCard),
      ).toEqual({});
    });

    it('sends the selected account as account or card', () => {
      const query = { ...defaultTransactionQuery(), accountId: 'card', search: ' farm ' };

      expect(toTransactionFilters(query, november, isCard)).toEqual({
        range: november,
        creditCardId: 'card',
        search: 'farm',
      });
      expect(
        toTransactionFilters(
          {
            ...query,
            accountId: 'checking',
            type: 'expense',
            status: 'pending',
            categoryId: 'food',
          },
          null,
          isCard,
        ),
      ).toEqual({
        type: 'expense',
        status: 'pending',
        accountId: 'checking',
        categoryId: 'food',
        search: 'farm',
      });
    });
  });

  describe('URL params', () => {
    it('writes only the filters that differ from the default, and clears the others', () => {
      expect(
        toQueryParams({
          ...defaultTransactionQuery(),
          search: '  farmácia ',
          type: 'expense',
          sort: 'amount-asc',
        }),
      ).toEqual({
        accountId: null,
        creditCardId: null,
        categoryId: null,
        busca: 'farmácia',
        tipo: 'expense',
        conta: null,
        categoria: null,
        status: null,
        ordem: 'amount-asc',
      });
    });

    it('reads the filters back, ignoring unknown values', () => {
      expect(
        fromQueryParams({ busca: 'farmácia', tipo: 'refund', status: 'pending', ordem: 'nome' }),
      ).toEqual({ ...defaultTransactionQuery(), search: 'farmácia', status: 'pending' });
    });

    it('accepts the link params of other pages', () => {
      expect(fromQueryParams({ creditCardId: 'card', categoryId: 'food' })).toMatchObject({
        accountId: 'card',
        categoryId: 'food',
      });
      expect(fromQueryParams({ conta: 'checking', accountId: 'savings' }).accountId).toBe(
        'checking',
      );
    });
  });

  describe('filterTransactions', () => {
    it('matches the account as origin or destination, and the card separately', () => {
      expect(descriptions(filterTransactions(transactions, { accountId: 'savings' }))).toEqual([
        'Reserva',
      ]);
      expect(descriptions(filterTransactions(transactions, { creditCardId: 'card' }))).toEqual([
        'Farmácia',
      ]);
      expect(descriptions(filterTransactions(transactions, { accountId: 'checking' }))).toEqual([
        'Mercado',
        'Salário',
        'Reserva',
        'Aluguel',
      ]);
    });

    it('combines period, type, status, category and accent-insensitive search', () => {
      expect(
        descriptions(filterTransactions(transactions, { range: november, type: 'expense' })),
      ).toEqual(['Mercado', 'Aluguel']);
      expect(descriptions(filterTransactions(transactions, { status: 'pending' }))).toEqual([
        'Aluguel',
      ]);
      expect(descriptions(filterTransactions(transactions, { categoryId: 'salary' }))).toEqual([
        'Salário',
      ]);
      expect(descriptions(filterTransactions(transactions, { search: 'FARMACIA' }))).toEqual([
        'Farmácia',
      ]);
      expect(descriptions(filterTransactions(transactions, { search: 'novembro' }))).toEqual([
        'Aluguel',
      ]);
    });
  });

  describe('pageTransactions', () => {
    function allPages(sort: 'date-desc' | 'amount-asc', limit: number): string[][] {
      const pages: string[][] = [];
      let cursor: string | null = null;
      do {
        const page = pageTransactions(transactions, { filters: {}, sort, cursor, limit });
        pages.push(descriptions(page.items));
        cursor = page.nextCursor;
      } while (cursor);
      return pages;
    }

    it('splits the sorted result into pages, ties broken by the last registered first', () => {
      expect(allPages('date-desc', 2)).toEqual([
        ['Aluguel', 'Reserva'],
        ['Salário', 'Mercado'],
        ['Farmácia'],
      ]);
      expect(allPages('amount-asc', 3).flat()).toEqual([
        'Farmácia',
        'Aluguel',
        'Reserva',
        'Mercado',
        'Salário',
      ]);
    });

    it('does not promise another page after a full last page', () => {
      expect(
        pageTransactions(transactions, { filters: {}, sort: 'date-desc', cursor: null, limit: 5 })
          .nextCursor,
      ).toBeNull();
    });

    it('rejects a cursor from another sort', () => {
      const { nextCursor } = pageTransactions(transactions, {
        filters: {},
        sort: 'date-desc',
        cursor: null,
        limit: 1,
      });

      expect(() =>
        pageTransactions(transactions, {
          filters: {},
          sort: 'amount-asc',
          cursor: nextCursor,
          limit: 1,
        }),
      ).toThrow(InvalidTransactionCursorError);
    });
  });

  it('totals every filtered transaction, counting transfers and pending ones apart', () => {
    expect(totalTransactions(transactions, { range: november })).toEqual({
      count: 4,
      income: 500_000,
      expense: 30_000,
      net: 470_000,
      pendingCount: 1,
    });
    expect(totalTransactions(transactions, { creditCardId: 'card' })).toEqual({
      count: 1,
      income: 0,
      expense: 4_500,
      net: -4_500,
      pendingCount: 0,
    });
    expect(totalTransactions(transactions, { accountId: 'none' })).toEqual({
      count: 0,
      income: 0,
      expense: 0,
      net: 0,
      pendingCount: 0,
    });
  });
});
