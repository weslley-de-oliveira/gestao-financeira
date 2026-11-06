import { Cents } from '../utils/money';
import { DateRange } from './period';
import { Transaction, TransactionStatus, TransactionType } from './transaction';

export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

/** Filtros da consulta de transações, combináveis; os ausentes não restringem nada. */
export interface TransactionFilters {
  /** Período, com as duas datas inclusive. */
  range?: DateRange;
  type?: TransactionType;
  status?: TransactionStatus;
  /** Transações que saem ou entram nesta conta (origem ou destino). */
  accountId?: string;
  /** Compras e pagamentos de fatura deste cartão. */
  creditCardId?: string;
  categoryId?: string;
  /** Busca na descrição e nas observações, sem diferenciar maiúsculas e acentos. */
  search?: string;
}

/** Uma página da consulta: os filtros, a ordenação e a posição (`null` na primeira página). */
export interface TransactionPageRequest {
  filters: TransactionFilters;
  sort: TransactionSort;
  cursor: string | null;
  limit: number;
}

export interface TransactionPage {
  items: Transaction[];
  /** Posição da próxima página; `null` quando acabou. */
  nextCursor: string | null;
}

/** Totais de todas as transações que passam nos filtros, não só os da página. */
export interface TransactionTotals {
  count: number;
  /** Receitas realizadas. */
  income: Cents;
  /** Despesas realizadas, incluindo as compras no cartão. */
  expense: Cents;
  /** Receitas − despesas. */
  net: Cents;
  /** Pendentes de qualquer tipo, fora dos totais. */
  pendingCount: number;
}
