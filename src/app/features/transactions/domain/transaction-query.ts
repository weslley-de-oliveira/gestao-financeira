import { DateRange, isInRange } from '../../../shared/models/period';
import {
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../../shared/models/transaction';
import {
  TransactionFilters,
  TransactionPage,
  TransactionPageRequest,
  TransactionSort,
  TransactionTotals,
} from '../../../shared/models/transaction-query';
import { normalizeForSearch } from '../../../shared/utils/text';
import { summarizeTransactions } from './transaction-rules';

export type { TransactionSort } from '../../../shared/models/transaction-query';

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
        (!search || matchesSearch(transaction, search)),
    )
    .sort((a, b) => compareTransactions(a, b, query.sort));
}

/**
 * Converte os filtros da tela nos filtros da consulta. O seletor de conta mistura contas e
 * cartões: `isCard` diz qual dos dois foi escolhido.
 */
export function toTransactionFilters(
  query: TransactionQuery,
  range: DateRange | null,
  isCard: (id: string) => boolean,
): TransactionFilters {
  const search = query.search.trim();
  const account = query.accountId === ALL ? undefined : query.accountId;
  return {
    ...(range && { range }),
    ...(query.type !== 'all' && { type: query.type }),
    ...(query.status !== 'all' && { status: query.status }),
    ...(account && (isCard(account) ? { creditCardId: account } : { accountId: account })),
    ...(query.categoryId !== ALL && { categoryId: query.categoryId }),
    ...(search && { search }),
  };
}

/** As transações que passam em todos os filtros, na ordem original. */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const search = normalizeForSearch(filters.search?.trim() ?? '');
  return transactions.filter(
    (transaction) =>
      (!filters.range || isInRange(transaction.date, filters.range)) &&
      (!filters.type || transaction.type === filters.type) &&
      (!filters.status || transaction.status === filters.status) &&
      (!filters.accountId ||
        transaction.accountId === filters.accountId ||
        transaction.destinationAccountId === filters.accountId) &&
      (!filters.creditCardId || transaction.creditCardId === filters.creditCardId) &&
      (!filters.categoryId || transaction.categoryId === filters.categoryId) &&
      (!search || matchesSearch(transaction, search)),
  );
}

/**
 * Uma página da consulta sobre a lista completa (demonstração e testes), com as mesmas regras da
 * API. O cursor é a ordenação e a posição do próximo item.
 */
export function pageTransactions(
  transactions: readonly Transaction[],
  { filters, sort, cursor, limit }: TransactionPageRequest,
): TransactionPage {
  const sorted = filterTransactions(transactions, filters).sort((a, b) =>
    compareTransactions(a, b, sort),
  );
  const start = cursor ? offsetOf(cursor, sort) : 0;
  const end = start + limit;
  return {
    items: sorted.slice(start, end),
    nextCursor: end < sorted.length ? `${sort}:${end}` : null,
  };
}

/** Totais de todas as transações que passam nos filtros. */
export function totalTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): TransactionTotals {
  const filtered = filterTransactions(transactions, filters);
  return { count: filtered.length, ...summarizeTransactions(filtered) };
}

export class InvalidTransactionCursorError extends Error {
  constructor() {
    super('Cursor from another sort or not generated by pageTransactions');
    this.name = 'InvalidTransactionCursorError';
  }
}

function offsetOf(cursor: string, sort: TransactionSort): number {
  const [cursorSort, offset] = cursor.split(':');
  const position = Number(offset);
  if (cursorSort !== sort || !Number.isSafeInteger(position) || position < 0) {
    throw new InvalidTransactionCursorError();
  }
  return position;
}

function matchesSearch(transaction: Transaction, search: string): boolean {
  return (
    normalizeForSearch(transaction.description).includes(search) ||
    normalizeForSearch(transaction.notes ?? '').includes(search)
  );
}

export function compareTransactions(a: Transaction, b: Transaction, sort: TransactionSort): number {
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

/** Parâmetros da URL da listagem, em português, um por filtro. */
export const TRANSACTION_QUERY_PARAMS = {
  search: 'busca',
  type: 'tipo',
  accountId: 'conta',
  categoryId: 'categoria',
  status: 'status',
  sort: 'ordem',
} as const satisfies Record<keyof TransactionQuery, string>;

/** Parâmetros que outras telas usam para abrir a listagem já filtrada. */
const LINK_PARAMS = ['accountId', 'creditCardId', 'categoryId'] as const;

type QueryParamValues = Readonly<Record<string, string | null | undefined>>;

/**
 * Filtros a partir dos parâmetros da URL; valores desconhecidos ficam no padrão. Também aceita
 * os parâmetros dos links de outras telas (`accountId`, `creditCardId`, `categoryId`).
 */
export function fromQueryParams(params: QueryParamValues): TransactionQuery {
  const query = defaultTransactionQuery();
  const value = (key: keyof TransactionQuery) => params[TRANSACTION_QUERY_PARAMS[key]] ?? null;
  const type = value('type');
  const status = value('status');
  const sort = value('sort');
  return {
    search: value('search') ?? query.search,
    type: TRANSACTION_TYPES.find((item) => item === type) ?? query.type,
    accountId: value('accountId') ?? params['accountId'] ?? params['creditCardId'] ?? ALL,
    categoryId: value('categoryId') ?? params['categoryId'] ?? ALL,
    status: TRANSACTION_STATUSES.find((item) => item === status) ?? query.status,
    sort: TRANSACTION_SORT_OPTIONS.find((option) => option.value === sort)?.value ?? query.sort,
  };
}

/**
 * Parâmetros da URL para os filtros: só os diferentes do padrão. Os demais (e os dos links de
 * outras telas) vão como `null`, para o roteador tirá-los da URL.
 */
export function toQueryParams(query: TransactionQuery): Record<string, string | null> {
  const defaults = defaultTransactionQuery();
  const params: Record<string, string | null> = Object.fromEntries(
    LINK_PARAMS.map((key) => [key, null]),
  );
  for (const key of Object.keys(TRANSACTION_QUERY_PARAMS) as (keyof TransactionQuery)[]) {
    const value = key === 'search' ? query.search.trim() : query[key];
    params[TRANSACTION_QUERY_PARAMS[key]] = value === defaults[key] ? null : value;
  }
  return params;
}
