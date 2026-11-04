import { Cents } from '../utils/money';
import { IsoMonth } from '../utils/month';

/** Percentuais de alerta oferecidos no formulário. */
export const ALERT_THRESHOLD_OPTIONS: readonly number[] = [50, 60, 70, 75, 80, 85, 90, 95, 100];

export const DEFAULT_ALERT_THRESHOLD = 80;

/** Limite mensal em vigor a partir de `month` (inclusive) até a próxima vigência. */
export interface BudgetLimit {
  month: IsoMonth;
  amount: Cents;
}

/**
 * Limite mensal recorrente de gastos de uma categoria de despesa: vale para todo mês a partir da
 * primeira vigência. Mudar o valor cria uma vigência nova, preservando os meses anteriores.
 * Há no máximo um orçamento por categoria.
 */
export interface Budget {
  id: string;
  userId: string;
  /** Categoria de despesa; não muda depois da criação. */
  categoryId: string;
  /** Vigências do limite, em ordem crescente de mês; nunca vazia. */
  limits: BudgetLimit[];
  /** Percentual do limite (1–100) a partir do qual o orçamento fica em alerta. */
  alertThreshold: number;
  createdAt: string;
}

/** Situação do orçamento no mês: o texto sempre acompanha a cor. */
export type BudgetState = 'ok' | 'warning' | 'exceeded';

export const BUDGET_STATE_LABELS: Readonly<Record<BudgetState, string>> = {
  ok: 'Dentro do limite',
  warning: 'Próximo do limite',
  exceeded: 'Limite excedido',
};

/** Ícone de cada situação, exibido junto ao texto (a situação nunca é indicada só por cor). */
export const BUDGET_STATE_ICONS: Readonly<Record<BudgetState, string>> = {
  ok: 'check_circle',
  warning: 'warning',
  exceeded: 'error',
};

/** Consumo de um orçamento num mês, calculado a partir das transações (não persistido). */
export interface BudgetProgress {
  budget: Budget;
  month: IsoMonth;
  limit: Cents;
  /** Despesas realizadas da categoria no mês, incluindo compras no cartão. */
  spent: Cents;
  /** Despesas pendentes da categoria no mês, exibidas à parte como previstas. */
  pending: Cents;
  /** Limite − gasto; negativo quando excedido. */
  available: Cents;
  /** Percentual gasto, sem arredondamento para cima de 100. */
  percent: number;
  state: BudgetState;
}
