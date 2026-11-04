import { Component, OnInit, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TODAY } from '../../../core/services/period.service';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { openConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  BUDGET_STATE_ICONS,
  BUDGET_STATE_LABELS,
  BudgetProgress,
} from '../../../shared/models/budget';
import { Category } from '../../../shared/models/category';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { formatMonth, isIsoMonth, shiftMonth, toIsoMonth } from '../../../shared/utils/month';
import { CategoriesFacade } from '../../categories/categories.facade';
import { TransactionsFacade } from '../../transactions/transactions.facade';
import { BudgetsFacade } from '../budgets.facade';
import { budgetProgress, progressBarValue, summarizeBudgets } from '../domain/budget-rules';

/** Orçamentos do mês escolhido (`/budgets?month=yyyy-MM`; sem parâmetro, o mês atual). */
@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatMenuModule,
    MatProgressBar,
    IconAvatar,
    MoneyPipe,
  ],
  selector: 'app-budget-list-page',
  templateUrl: './budget-list-page.html',
  styleUrl: './budget-list-page.scss',
})
export class BudgetListPage implements OnInit {
  private readonly facade = inject(BudgetsFacade);
  private readonly transactionsFacade = inject(TransactionsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly today = inject(TODAY);

  /** Query param do mês. */
  readonly month = input<string>();

  protected readonly currentMonth = toIsoMonth(this.today());
  protected readonly selectedMonth = computed(() => {
    const month = this.month();
    return isIsoMonth(month) ? month : this.currentMonth;
  });
  protected readonly monthLabel = computed(() => formatMonth(this.selectedMonth()));

  protected readonly status = computed(() => {
    const statuses = [
      this.facade.status(),
      this.transactionsFacade.status(),
      this.categoriesFacade.status(),
    ];
    return statuses.includes('error')
      ? 'error'
      : statuses.includes('loading')
        ? 'loading'
        : 'ready';
  });
  protected readonly hasBudgets = computed(() => this.facade.budgets().length > 0);

  /** Orçamentos que valem no mês, dos mais consumidos para os menos. */
  protected readonly progress = computed(() => {
    const month = this.selectedMonth();
    const transactions = this.transactionsFacade.transactions();
    return this.facade
      .budgets()
      .map((budget) => budgetProgress(budget, transactions, month))
      .filter((item): item is BudgetProgress => item !== null)
      .sort((a, b) => b.percent - a.percent);
  });
  protected readonly summary = computed(() => summarizeBudgets(this.progress()));
  private readonly categories = computed(
    () => new Map(this.categoriesFacade.categories().map((category) => [category.id, category])),
  );

  protected readonly stateLabels = BUDGET_STATE_LABELS;
  protected readonly stateIcons = BUDGET_STATE_ICONS;
  protected readonly progressBarValue = progressBarValue;

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    void this.facade.load();
    void this.transactionsFacade.load();
    void this.categoriesFacade.load();
  }

  protected goToMonth(amount: number): void {
    this.navigateTo(shiftMonth(this.selectedMonth(), amount));
  }

  protected goToCurrentMonth(): void {
    this.navigateTo(this.currentMonth);
  }

  /** O mês fica na URL; o atual é o padrão e não precisa de parâmetro. */
  private navigateTo(month: string): void {
    void this.router.navigate([], {
      queryParams: { month: month === this.currentMonth ? null : month },
      replaceUrl: true,
    });
  }

  protected categoryOf(progress: BudgetProgress): Category | undefined {
    return this.categories().get(progress.budget.categoryId);
  }

  protected async delete(progress: BudgetProgress): Promise<void> {
    const name = this.categoryOf(progress)?.name ?? 'categoria';
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Excluir o orçamento de "${name}"?`,
        message:
          'O limite deixa de ser acompanhado em todos os meses. As transações não são alteradas.',
        confirmLabel: 'Excluir',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.facade.delete(progress.budget.id);
      this.notify('Orçamento excluído.');
    } catch {
      this.notify('Não foi possível excluir o orçamento. Tente novamente.');
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000 });
  }
}
