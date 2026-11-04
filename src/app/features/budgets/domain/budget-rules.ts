import {
  ALERT_THRESHOLD_OPTIONS,
  Budget,
  BudgetLimit,
  BudgetProgress,
  BudgetState,
} from '../../../shared/models/budget';
import { isInRange } from '../../../shared/models/period';
import { Transaction } from '../../../shared/models/transaction';
import { Cents, MAX_MONEY_CENTS, isValidCents } from '../../../shared/utils/money';
import { IsoMonth, isIsoMonth, monthRange } from '../../../shared/utils/month';

/** Dados editáveis de um orçamento: o limite informado vale do mês atual em diante. */
export interface BudgetInput {
  categoryId: string;
  limitAmount: Cents;
  alertThreshold: number;
}

export class InvalidBudgetInputError extends Error {
  constructor(readonly field: keyof BudgetInput) {
    super(`Invalid budget ${field}`);
    this.name = 'InvalidBudgetInputError';
  }
}

export function normalizeBudgetInput(input: BudgetInput): BudgetInput {
  if (!input.categoryId) {
    throw new InvalidBudgetInputError('categoryId');
  }
  if (
    !isValidCents(input.limitAmount) ||
    input.limitAmount <= 0 ||
    input.limitAmount > MAX_MONEY_CENTS
  ) {
    throw new InvalidBudgetInputError('limitAmount');
  }
  if (!ALERT_THRESHOLD_OPTIONS.includes(input.alertThreshold)) {
    throw new InvalidBudgetInputError('alertThreshold');
  }
  return { ...input };
}

/** Limite em vigor no mês, ou `null` se o orçamento ainda não existia nele. */
export function limitForMonth(budget: Pick<Budget, 'limits'>, month: IsoMonth): Cents | null {
  let amount: Cents | null = null;
  for (const limit of budget.limits) {
    if (limit.month > month) {
      break;
    }
    amount = limit.amount;
  }
  return amount;
}

/** Limite atual: o da vigência mais recente. */
export function currentLimit(budget: Pick<Budget, 'limits'>): Cents {
  return budget.limits[budget.limits.length - 1].amount;
}

/**
 * Aplica um novo limite a partir de `month`: substitui a vigência desse mês ou acrescenta uma
 * nova, descartando vigências posteriores. Os meses anteriores mantêm o limite que tinham.
 */
export function withLimitFrom(
  limits: readonly BudgetLimit[],
  month: IsoMonth,
  amount: Cents,
): BudgetLimit[] {
  if (!isIsoMonth(month)) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  const earlier = limits.filter((limit) => limit.month < month);
  if (earlier.length > 0 && earlier[earlier.length - 1].amount === amount) {
    return earlier;
  }
  return [...earlier, { month, amount }];
}

/**
 * Consumo do orçamento no mês: despesas da categoria pela data (compras no cartão incluídas, pela
 * data da compra). Só as realizadas contam; as pendentes ficam à parte como previstas.
 * Transferências e pagamentos de fatura não são despesas e não entram. Retorna `null` se o
 * orçamento não vale no mês.
 */
export function budgetProgress(
  budget: Budget,
  transactions: readonly Transaction[],
  month: IsoMonth,
): BudgetProgress | null {
  const limit = limitForMonth(budget, month);
  if (limit === null) {
    return null;
  }
  const range = monthRange(month);
  let spent = 0;
  let pending = 0;
  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      transaction.categoryId !== budget.categoryId ||
      !isInRange(transaction.date, range)
    ) {
      continue;
    }
    if (transaction.status === 'pending') {
      pending += transaction.amount;
    } else {
      spent += transaction.amount;
    }
  }
  const percent = (spent / limit) * 100;
  return {
    budget,
    month,
    limit,
    spent,
    pending,
    available: limit - spent,
    percent,
    state: budgetState(percent, budget.alertThreshold),
  };
}

/** Excedido acima de 100%; em alerta a partir do percentual definido (100% inclusive). */
export function budgetState(percent: number, alertThreshold: number): BudgetState {
  if (percent > 100) {
    return 'exceeded';
  }
  return percent >= alertThreshold ? 'warning' : 'ok';
}

export interface BudgetSummary {
  limit: Cents;
  spent: Cents;
  available: Cents;
  attentionCount: number;
}

/** Totais do mês: orçado, gasto, disponível e quantos estão em alerta ou excedidos. */
export function summarizeBudgets(progress: readonly BudgetProgress[]): BudgetSummary {
  const limit = progress.reduce((total, item) => total + item.limit, 0);
  const spent = progress.reduce((total, item) => total + item.spent, 0);
  return {
    limit,
    spent,
    available: limit - spent,
    attentionCount: progress.filter((item) => item.state !== 'ok').length,
  };
}

/** Percentual para barras de progresso, limitado a 0–100. */
export function progressBarValue(progress: Pick<BudgetProgress, 'percent'>): number {
  return Math.min(100, Math.max(0, Math.round(progress.percent)));
}
