import { AccountWithBalance } from '../../../shared/models/account';
import { AccountQuery, defaultAccountQuery, queryAccounts } from './account-query';

function account(overrides: Partial<AccountWithBalance>): AccountWithBalance {
  return {
    id: overrides.name ?? 'id',
    userId: 'user',
    name: 'Conta',
    type: 'checking',
    institution: null,
    initialBalance: 0,
    currentBalance: 0,
    color: '#1565c0',
    icon: 'account_balance',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('queryAccounts', () => {
  const accounts = [
    account({ name: 'Nubank', institution: 'Nu Pagamentos', currentBalance: 50_000 }),
    account({ name: 'Carteira', type: 'cash', currentBalance: 3_000 }),
    account({ name: 'Poupança', type: 'savings', institution: 'Caixa', currentBalance: 90_000 }),
    account({ name: 'Antiga', institution: 'Banco Extinto', isArchived: true, currentBalance: 0 }),
  ];

  function names(query: Partial<AccountQuery>): string[] {
    return queryAccounts(accounts, { ...defaultAccountQuery(), ...query }).map((a) => a.name);
  }

  it('shows only active accounts sorted by name by default', () => {
    expect(names({})).toEqual(['Carteira', 'Nubank', 'Poupança']);
  });

  it('searches by name or institution ignoring case and accents', () => {
    expect(names({ search: 'poupanca' })).toEqual(['Poupança']);
    expect(names({ search: ' CAIXA ' })).toEqual(['Poupança']);
    expect(names({ search: 'pagamentos' })).toEqual(['Nubank']);
    expect(names({ search: 'inexistente' })).toEqual([]);
  });

  it('filters by type and status', () => {
    expect(names({ type: 'cash' })).toEqual(['Carteira']);
    expect(names({ status: 'archived' })).toEqual(['Antiga']);
    expect(names({ status: 'all' })).toHaveLength(4);
    expect(names({ status: 'all', search: 'banco' })).toEqual(['Antiga']);
  });

  it('sorts by balance in both directions', () => {
    expect(names({ sort: 'balance-desc' })).toEqual(['Poupança', 'Nubank', 'Carteira']);
    expect(names({ sort: 'balance-asc' })).toEqual(['Carteira', 'Nubank', 'Poupança']);
  });

  it('does not mutate the original list', () => {
    const original = [...accounts];
    queryAccounts(accounts, { ...defaultAccountQuery(), sort: 'balance-desc' });
    expect(accounts).toEqual(original);
  });
});
