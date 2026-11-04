import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { GOAL_STATUS_ICONS, GOAL_STATUS_LABELS, Goal } from '../../../shared/models/goal';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { GoalFilter, GOAL_FILTER_OPTIONS, queryGoals } from '../domain/goal-query';
import { goalProgressBarValue } from '../domain/goal-rules';
import { GoalActions } from '../goal-actions';
import { GoalsFacade } from '../goals.facade';

@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIcon,
    MatMenuModule,
    MatProgressBar,
    MatSelectModule,
    IconAvatar,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-goal-list-page',
  templateUrl: './goal-list-page.html',
  styleUrl: './goal-list-page.scss',
})
export class GoalListPage implements OnInit {
  private readonly facade = inject(GoalsFacade);
  private readonly actions = inject(GoalActions);

  private readonly filter = signal<{ status: GoalFilter }>({ status: 'active' });
  protected readonly filterForm = form(this.filter);

  protected readonly status = this.facade.status;
  protected readonly hasGoals = computed(() => this.facade.goals().length > 0);
  protected readonly visibleGoals = computed(() =>
    queryGoals(this.facade.goals(), this.filter().status),
  );
  /** Totais das metas ativas. */
  protected readonly totals = computed(() =>
    this.facade
      .goals()
      .filter((goal) => !goal.isArchived)
      .reduce(
        (totals, goal) => ({
          count: totals.count + 1,
          saved: totals.saved + goal.currentAmount,
          target: totals.target + goal.targetAmount,
        }),
        { count: 0, saved: 0, target: 0 },
      ),
  );

  protected readonly filterOptions = GOAL_FILTER_OPTIONS;
  protected readonly statusLabels = GOAL_STATUS_LABELS;
  protected readonly statusIcons = GOAL_STATUS_ICONS;
  protected readonly progressBarValue = goalProgressBarValue;

  ngOnInit(): void {
    void this.facade.load();
  }

  protected reload(): void {
    void this.facade.load();
  }

  protected showAll(): void {
    this.filter.set({ status: 'all' });
  }

  protected togglePaused(goal: Goal): void {
    void this.actions.togglePaused(goal);
  }

  protected toggleArchived(goal: Goal): void {
    void this.actions.toggleArchived(goal);
  }
}
