import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  BUDGET_STATE_ICONS,
  BUDGET_STATE_LABELS,
  BudgetProgress,
} from '../../../shared/models/budget';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CategoriesFacade } from '../../categories/categories.facade';
import { progressBarValue } from '../domain/budget-rules';

/** Lista compacta de orçamentos com situação e barra de consumo (usada no Dashboard). */
@Component({
  imports: [MatIcon, MatProgressBar, MoneyPipe],
  selector: 'app-budget-highlights',
  templateUrl: './budget-highlights.html',
  styleUrl: './budget-highlights.scss',
})
export class BudgetHighlights {
  private readonly categoriesFacade = inject(CategoriesFacade);

  readonly items = input.required<readonly BudgetProgress[]>();

  private readonly names = computed(
    () =>
      new Map(this.categoriesFacade.categories().map((category) => [category.id, category.name])),
  );
  protected readonly stateLabels = BUDGET_STATE_LABELS;
  protected readonly stateIcons = BUDGET_STATE_ICONS;
  protected readonly progressBarValue = progressBarValue;

  protected nameOf(progress: BudgetProgress): string {
    return this.names().get(progress.budget.categoryId) ?? 'Categoria removida';
  }
}
