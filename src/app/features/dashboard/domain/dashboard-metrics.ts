import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Account } from '../../../shared/models/account';
import { DateRange, isInRange } from '../../../shared/models/period';
import { Transaction } from '../../../shared/models/transaction';
import { IsoDate, parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { movementEffect } from '../../accounts/domain/account-balance';
import {
  defaultTransactionQuery,
  queryTransactions,
} from '../../transactions/domain/transaction-query';
import { summarizeTransactions } from '../../transactions/domain/transaction-rules';

/** Faixa de datas agrupada num ponto do gráfico de receitas × despesas. */
export interface PeriodBucket extends DateRange {
  label: string;
}

/** Dias por bloco quando o período tem um único mês. */
const DAYS_PER_BLOCK = 7;

/**
 * Divide o período para o gráfico: um bloco por mês quando abrange vários meses; num único mês,
 * blocos de 7 dias a partir do dia 1 (o último fica com o que sobrar).
 */
export function periodBuckets(range: DateRange): PeriodBucket[] {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (!start || !end || range.start > range.end) {
    return [];
  }
  const singleMonth = range.start.slice(0, 7) === range.end.slice(0, 7);
  const buckets: PeriodBucket[] = [];

  for (let first = start; first <= end;) {
    const last = singleMonth
      ? minDate(addDays(first, DAYS_PER_BLOCK - 1), end)
      : minDate(new Date(first.getFullYear(), first.getMonth() + 1, 0), end);
    buckets.push({
      start: toIsoDate(first),
      end: toIsoDate(last),
      label: singleMonth
        ? `${format(first, 'dd')}–${format(last, 'dd')}`
        : format(first, 'MMM/yy', { locale: ptBR }),
    });
    first = addDays(last, 1);
  }
  return buckets;
}

export interface IncomeExpensePoint {
  label: string;
  income: Cents;
  expense: Cents;
}

/**
 * Receitas e despesas de cada bloco do período, pela mesma regra dos cards
 * (`summarizeTransactions`): só realizadas, sem transferências.
 */
export function incomeVsExpense(
  transactions: readonly Transaction[],
  range: DateRange,
): IncomeExpensePoint[] {
  return periodBuckets(range).map((bucket) => {
    const { income, expense } = summarizeTransactions(
      transactions.filter((transaction) => isInRange(transaction.date, bucket)),
    );
    return { label: bucket.label, income, expense };
  });
}

export interface BalancePoint {
  date: IsoDate;
  balance: Cents;
}

/**
 * Saldo consolidado das contas ativas ao fim de cada dia do período: saldos iniciais + efeito
 * das transações até aquele dia, pela regra única do saldo (`movementEffect`; pendentes não
 * contam e transferências entre contas ativas se anulam).
 */
export function balanceEvolution(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  range: DateRange,
): BalancePoint[] {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (!start || !end) {
    return [];
  }
  const active = accounts.filter((account) => !account.isArchived);
  const effect = (transaction: Transaction) =>
    active.reduce((total, account) => total + movementEffect(transaction, account.id), 0);
  const chronological = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  let balance = active.reduce((total, account) => total + account.initialBalance, 0);
  let next = 0;
  const points: BalancePoint[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const date = toIsoDate(day);
    while (next < chronological.length && chronological[next].date <= date) {
      balance += effect(chronological[next++]);
    }
    points.push({ date, balance });
  }
  return points;
}

/** Transações mais recentes do período (por data e, no mesmo dia, pela ordem de registro). */
export function recentTransactions(
  transactions: readonly Transaction[],
  range: DateRange,
  limit: number,
): Transaction[] {
  return queryTransactions(transactions, defaultTransactionQuery(), range).slice(0, limit);
}

function minDate(a: Date, b: Date): Date {
  return a <= b ? a : b;
}
