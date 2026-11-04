import { DateRange, isInRange } from '../../../shared/models/period';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../../shared/models/transaction';
import { normalizeForSearch } from '../../../shared/utils/text';

export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export interface TransactionQuery {
  search: string;
  type: TransactionType | 'all';
  /** Conta de origem ou de destino, ou o cartão das compras (os ids nunca coincidem). */
  accountId: string;
  categoryId: string;
  status: TransactionStatus | 'all';
  sort: TransactionSort;
}

/** Valor dos filtros de conta e categoria que significa "todas". */
export const ALL = 'all';

export const defaultTransactionQuery = (): TransactionQuery => ({
  search: '',
  type: 'all',
  accountId: ALL,
  categoryId: ALL,
  status: 'all',
  sort: 'date-desc',
});

export const TRANSACTION_SORT_OPTIONS: readonly { value: TransactionSort; label: string }[] = [
  { value: 'date-desc', label: 'Mais recentes' },
  { value: 'date-asc', label: 'Mais antigas' },
  { value: 'amount-desc', label: 'Maior valor' },
  { value: 'amount-asc', label: 'Menor valor' },
];

/** Aplica período, busca (descrição e observações) e filtros combináveis, depois ordena. */
export function queryTransactions(
  transactions: readonly Transaction[],
  query: TransactionQuery,
  range: DateRange | null,
): Transaction[] {
  const search = normalizeForSearch(query.search.trim());

  return transactions
    .filter(
      (transaction) =>
        (!range || isInRange(transaction.date, range)) &&
        (query.type === 'all' || transaction.type === query.type) &&
        (query.status === 'all' || transaction.status === query.status) &&
        (query.accountId === ALL ||
          transaction.accountId === query.accountId ||
          transaction.destinationAccountId === query.accountId ||
          transaction.creditCardId === query.accountId) &&
        (query.categoryId === ALL || transaction.categoryId === query.categoryId) &&
        (!search ||
          normalizeForSearch(transaction.description).includes(search) ||
          normalizeForSearch(transaction.notes ?? '').includes(search)),
    )
    .sort((a, b) => compare(a, b, query.sort));
}

function compare(a: Transaction, b: Transaction, sort: TransactionSort): number {
  // Desempate estável: a mais recente registrada primeiro.
  const byCreation = b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case 'date-desc':
      return b.date.localeCompare(a.date) || byCreation;
    case 'date-asc':
      return a.date.localeCompare(b.date) || -byCreation;
    case 'amount-desc':
      return b.amount - a.amount || byCreation;
    case 'amount-asc':
      return a.amount - b.amount || byCreation;
  }
}
