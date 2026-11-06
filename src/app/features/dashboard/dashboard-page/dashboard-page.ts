import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PeriodService } from '../../../core/services/period.service';
import { TODAY } from '../../../core/services/today';
import { ChartSpec } from '../../../shared/components/chart/chart-spec';
import { ChartView } from '../../../shared/components/chart/chart-view';
import { PERIOD_OPTIONS } from '../../../shared/models/period';
import { Transaction } from '../../../shared/models/transaction';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { formatIsoDate } from '../../../shared/utils/date';
import { formatMonth, toIsoMonth } from '../../../shared/utils/month';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { BudgetHighlights } from '../../budgets/budget-highlights/budget-highlights';
import { GoalHighlights } from '../../goals/goal-highlights/goal-highlights';
import { CategoriesFacade } from '../../categories/categories.facade';
import { CreditCardsFacade } from '../../credit-cards/credit-cards.facade';
import { DashboardFacade, LoadStatus } from '../dashboard.facade';
import {
  TRANSACTION_SIGNS,
  TRANSACTION_TYPE_ICONS,
  TransactionLookups,
  accountLabel,
  byId,
} from '../../transactions/transaction-display';

interface Shortcut {
  label: string;
  path: string;
  icon: string;
}

const SHORTCUTS: readonly Shortcut[] = [
  { label: 'Contas', path: '/accounts', icon: 'account_balance_wallet' },
  { label: 'Transações', path: '/transactions', icon: 'swap_horiz' },
  { label: 'Categorias', path: '/categories', icon: 'sell' },
  { label: 'Cartões', path: '/credit-cards', icon: 'credit_card' },
];

/** Status de um widget que depende de mais de uma fonte: o pior entre elas. */
function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  return statuses.includes('error') ? 'error' : statuses.includes('loading') ? 'loading' : 'ready';
}

/**
 * Resumo do período selecionado na topbar, numa chamada só (`DashboardFacade`): na API, calculado
 * no servidor, sem baixar as transações; na demo, pelas mesmas regras no navegador. Contas e
 * cartões só dão os nomes das transações recentes.
 */
@Component({
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatProgressBar,
    ChartView,
    BudgetHighlights,
    GoalHighlights,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly dashboard = inject(DashboardFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly period = inject(PeriodService);
  private readonly today = inject(TODAY);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LOCALE_ID);
  private readonly currency = inject(DEFAULT_CURRENCY_CODE);

  private readonly money = new Intl.NumberFormat(this.locale, {
    style: 'currency',
    currency: this.currency,
  });
  /** Formato curto do eixo dos gráficos: "R$ 1,5 mil". */
  private readonly compactMoney = new Intl.NumberFormat(this.locale, {
    style: 'currency',
    currency: this.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  private readonly formatValue = (cents: number) => this.money.format(cents / 100);
  private readonly formatTick = (cents: number) => this.compactMoney.format(cents / 100);

  protected readonly firstName = computed(
    () => this.auth.currentUser()?.name.trim().split(/\s+/)[0] ?? '',
  );
  protected readonly periodLabel = computed(
    () => PERIOD_OPTIONS.find((option) => option.value === this.period.selected())?.label ?? '',
  );

  /** Todos os widgets vêm do mesmo resumo: carregam e falham juntos. */
  private readonly status = this.dashboard.status;
  private readonly data = this.dashboard.data;
  protected readonly accountsStatus = this.status;
  protected readonly transactionsStatus = this.status;
  protected readonly combinedStatus = this.status;
  protected readonly goalsStatus = this.status;
  /** O widget de orçamentos também precisa dos nomes das categorias. */
  protected readonly budgetsStatus = computed(() =>
    combineStatus(this.status(), this.categoriesFacade.status()),
  );
  protected readonly allFailed = computed(() => this.status() === 'error');
  /** Sem contas: o dashboard orienta os primeiros passos (sem conta, não há transações). */
  protected readonly isEmpty = computed(
    () =>
      this.status() === 'ready' &&
      this.accountsFacade.status() === 'ready' &&
      this.accountsFacade.accounts().length === 0,
  );

  protected readonly totalBalance = computed(() => this.data()?.balance.total ?? 0);
  protected readonly activeAccountsCount = computed(() => this.data()?.balance.activeAccounts ?? 0);
  protected readonly summary = computed(
    () => this.data()?.summary ?? { income: 0, expense: 0, net: 0, pendingCount: 0 },
  );

  protected readonly incomeExpenseChart = computed<ChartSpec>(() => {
    const points = this.data()?.incomeVsExpense ?? [];
    return {
      type: 'bar',
      labels: points.map((point) => point.label),
      series: [
        {
          label: 'Receitas',
          values: points.map((point) => point.income),
          color: '--chart-income',
        },
        {
          label: 'Despesas',
          values: points.map((point) => point.expense),
          color: '--chart-expense',
        },
      ],
      formatValue: this.formatValue,
      formatTick: this.formatTick,
    };
  });
  protected readonly hasIncomeOrExpense = computed(
    () => this.summary().income > 0 || this.summary().expense > 0,
  );

  protected readonly balanceChart = computed<ChartSpec>(() => {
    const points = this.data()?.balanceEvolution ?? [];
    return {
      type: 'line',
      labels: points.map((point) => formatIsoDate(point.date).slice(0, 5)),
      series: [
        {
          label: 'Saldo',
          values: points.map((point) => point.balance),
          color: '--chart-balance',
        },
      ],
      formatValue: this.formatValue,
      formatTick: this.formatTick,
    };
  });

  protected readonly recent = computed(() => this.data()?.recentTransactions ?? []);
  protected readonly lookups = computed<TransactionLookups>(() => ({
    accounts: byId(this.accountsFacade.accounts()),
    // A lista recente identifica o tipo pelo ícone; não precisa das categorias.
    categories: new Map(),
    creditCards: byId(this.creditCardsFacade.cards()),
  }));

  /** O widget de orçamentos usa sempre o mês atual, não o período da topbar. */
  protected readonly budgetMonthLabel = formatMonth(toIsoMonth(this.today()));
  protected readonly goalHighlights = computed(() => this.data()?.goalHighlights ?? []);
  protected readonly budgetHighlights = computed(() => this.data()?.budgetHighlights ?? []);

  protected readonly shortcuts = SHORTCUTS;
  protected readonly accountLabel = accountLabel;

  constructor() {
    // Recarrega o resumo a cada troca de período na topbar.
    effect(() => {
      const range = this.period.range();
      untracked(() => void this.dashboard.load(range));
    });
    this.loadLookups();
  }

  protected reload(): void {
    void this.dashboard.load(this.period.range());
    this.loadLookups();
  }

  protected reloadGoals(): void {
    this.reload();
  }

  protected reloadBudgets(): void {
    this.reload();
  }

  protected reloadAccounts(): void {
    this.reload();
  }

  protected reloadTransactions(): void {
    this.reload();
  }

  protected retryFailed(): void {
    this.reload();
  }

  protected typeIcon(transaction: Transaction): string {
    return TRANSACTION_TYPE_ICONS[transaction.type];
  }

  protected sign(transaction: Transaction): string {
    return TRANSACTION_SIGNS[transaction.type];
  }

  /** Nomes de contas, cartões e categorias; uma falha deles não bloqueia o resumo. */
  private loadLookups(): void {
    void this.accountsFacade.load();
    void this.creditCardsFacade.load();
    void this.categoriesFacade.load();
  }
}
