import { AccountType, AccountWithBalance } from '../../../shared/models/account';
import { normalizeForSearch } from '../../../shared/utils/text';

export type AccountStatusFilter = 'active' | 'archived' | 'all';
export type AccountSort = 'name' | 'balance-desc' | 'balance-asc';

export interface AccountQuery {
  search: string;
  type: AccountType | 'all';
  status: AccountStatusFilter;
  sort: AccountSort;
}

export const defaultAccountQuery = (): AccountQuery => ({
  search: '',
  type: 'all',
  status: 'active',
  sort: 'name',
});

export const ACCOUNT_STATUS_OPTIONS: readonly { value: AccountStatusFilter; label: string }[] = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
  { value: 'all', label: 'Todas' },
];

export const ACCOUNT_SORT_OPTIONS: readonly { value: AccountSort; label: string }[] = [
  { value: 'name', label: 'Nome (A–Z)' },
  { value: 'balance-desc', label: 'Maior saldo' },
  { value: 'balance-asc', label: 'Menor saldo' },
];

/** Busca por nome ou instituição (sem diferenciar maiúsculas e acentos), filtra e ordena. */
export function queryAccounts(
  accounts: readonly AccountWithBalance[],
  query: AccountQuery,
): AccountWithBalance[] {
  const search = normalizeForSearch(query.search.trim());

  return accounts
    .filter(
      (account) =>
        (query.type === 'all' || account.type === query.type) &&
        matchesStatus(account, query.status) &&
        (!search ||
          normalizeForSearch(account.name).includes(search) ||
          normalizeForSearch(account.institution ?? '').includes(search)),
    )
    .sort((a, b) => compare(a, b, query.sort));
}

function matchesStatus(account: AccountWithBalance, status: AccountStatusFilter): boolean {
  return status === 'all' || account.isArchived === (status === 'archived');
}

function compare(a: AccountWithBalance, b: AccountWithBalance, sort: AccountSort): number {
  const byName = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  switch (sort) {
    case 'name':
      return byName;
    case 'balance-desc':
      return b.currentBalance - a.currentBalance || byName;
    case 'balance-asc':
      return a.currentBalance - b.currentBalance || byName;
  }
}
