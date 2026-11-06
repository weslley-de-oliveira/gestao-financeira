import { IsoDate } from '../utils/date';
import { Cents } from '../utils/money';
import { BudgetProgress } from './budget';
import { GoalWithProgress } from './goal';
import { Transaction } from './transaction';

/** Totais do período: só realizadas; transferências e pagamentos de fatura ficam de fora. */
export interface DashboardSummary {
  income: Cents;
  expense: Cents;
  /** Receitas − despesas. */
  net: Cents;
  /** Pendentes do período, contadas à parte. */
  pendingCount: number;
}

/** Um ponto do gráfico de receitas × despesas (bloco de 7 dias ou mês). */
export interface IncomeExpensePoint {
  label: string;
  income: Cents;
  expense: Cents;
}

/** Saldo somado das contas ativas ao fim de um dia. */
export interface BalancePoint {
  date: IsoDate;
  balance: Cents;
}

/** Tudo o que o dashboard mostra para um período, calculado de uma vez. */
export interface DashboardData {
  summary: DashboardSummary;
  balance: {
    /** Saldo atual somado das contas ativas. */
    total: Cents;
    activeAccounts: number;
  };
  incomeVsExpense: IncomeExpensePoint[];
  balanceEvolution: BalancePoint[];
  /** As transações mais recentes do período. */
  recentTransactions: Transaction[];
  /** Os orçamentos mais consumidos no mês atual (não segue o período). */
  budgetHighlights: BudgetProgress[];
  /** Metas ativas não concluídas: atrasadas primeiro, depois o prazo mais próximo. */
  goalHighlights: GoalWithProgress[];
}
