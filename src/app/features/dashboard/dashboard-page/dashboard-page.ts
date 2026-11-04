import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PeriodService } from '../../../core/services/period.service';
import { ChartSpec } from '../../../shared/components/chart/chart-spec';
import { ChartView } from '../../../shared/components/chart/chart-view';
import { PERIOD_OPTIONS, isInRange } from '../../../shared/models/period';
import { Transaction } from '../../../shared/models/transaction';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { formatIsoDate } from '../../../shared/utils/date';
import { AccountsFacade, LoadStatus } from '../../accounts/accounts.facade';
import { summarizeTransactions } from '../../transactions/domain/transaction-rules';
import {
  TRANSACTION_SIGNS,
  TRANSACTION_TYPE_ICONS,
  TransactionLookups,
  accountLabel,
  byId,
} from '../../transactions/transaction-display';
import { TransactionsFacade } from '../../transactions/transactions.facade';
import { balanceEvolution, incomeVsExpense, recentTransactions } from '../domain/dashboard-metrics';

/** Quantidade de transações recentes exibidas. */
const RECENT_LIMIT = 5;

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
 * Resumo do período selecionado na topbar. Cards, gráficos e lista usam as mesmas transações da
 * `TransactionsFacade` e as mesmas regras (`summarizeTransactions` e a regra única do saldo).
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
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly transactionsFacade = inject(TransactionsFacade);
  private readonly period = inject(PeriodService);
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

  protected readonly accountsStatus = this.accountsFacade.status;
  protected readonly transactionsStatus = this.transactionsFacade.status;
  protected readonly combinedStatus = computed(() =>
    combineStatus(this.accountsStatus(), this.transactionsStatus()),
  );
  /** Erro geral: nenhuma das fontes carregou. */
  protected readonly allFailed = computed(
    () => this.accountsStatus() === 'error' && this.transactionsStatus() === 'error',
  );
  /** Sem contas e sem transações: o dashboard orienta os primeiros passos. */
  protected readonly isEmpty = computed(
    () =>
      this.combinedStatus() === 'ready' &&
      this.accountsFacade.accounts().length === 0 &&
      this.transactionsFacade.transactions().length === 0,
  );

  protected readonly totalBalance = this.accountsFacade.totalActiveBalance;
  protected readonly activeAccountsCount = computed(
    () => this.accountsFacade.accounts().filter((account) => !account.isArchived).length,
  );
  private readonly periodTransactions = computed(() => {
    const range = this.period.range();
    return this.transactionsFacade
      .transactions()
      .filter((transaction) => isInRange(transaction.date, range));
  });
  protected readonly summary = computed(() => summarizeTransactions(this.periodTransactions()));

  protected readonly incomeExpenseChart = computed<ChartSpec>(() => {
    const points = incomeVsExpense(this.periodTransactions(), this.period.range());
    return {
      type: 'bar',
      labels: points.map((point) => point.label),
      series: [
        {
          label: 'Receitas',
          values: points.map((point) => point.income),
          color: '--mat-sys-primary',
        },
        {
          label: 'Despesas',
          values: points.map((point) => point.expense),
          color: '--mat-sys-error',
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
    const points = balanceEvolution(
      this.accountsFacade.accounts(),
      this.transactionsFacade.transactions(),
      this.period.range(),
    );
    return {
      type: 'line',
      labels: points.map((point) => formatIsoDate(point.date).slice(0, 5)),
      series: [
        {
          label: 'Saldo',
          values: points.map((point) => point.balance),
          color: '--mat-sys-primary',
        },
      ],
      formatValue: this.formatValue,
      formatTick: this.formatTick,
    };
  });

  protected readonly recent = computed(() =>
    recentTransactions(this.transactionsFacade.transactions(), this.period.range(), RECENT_LIMIT),
  );
  protected readonly lookups = computed<TransactionLookups>(() => ({
    accounts: byId(this.accountsFacade.accounts()),
    // A lista recente identifica o tipo pelo ícone; não precisa das categorias.
    categories: new Map(),
  }));

  protected readonly shortcuts = SHORTCUTS;
  protected readonly accountLabel = accountLabel;

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.reloadAccounts();
    this.reloadTransactions();
  }

  protected reloadAccounts(): void {
    void this.accountsFacade.load();
  }

  protected reloadTransactions(): void {
    void this.transactionsFacade.load();
  }

  /** Recarrega só as fontes que falharam. */
  protected retryFailed(): void {
    if (this.accountsStatus() === 'error') {
      this.reloadAccounts();
    }
    if (this.transactionsStatus() === 'error') {
      this.reloadTransactions();
    }
  }

  protected typeIcon(transaction: Transaction): string {
    return TRANSACTION_TYPE_ICONS[transaction.type];
  }

  protected sign(transaction: Transaction): string {
    return TRANSACTION_SIGNS[transaction.type];
  }
}
