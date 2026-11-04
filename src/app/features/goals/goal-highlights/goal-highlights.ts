import { Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  GOAL_STATUS_ICONS,
  GOAL_STATUS_LABELS,
  GoalWithProgress,
} from '../../../shared/models/goal';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { goalProgressBarValue } from '../domain/goal-rules';

/** Lista compacta de metas com status, progresso e prazo (usada no Dashboard). */
@Component({
  imports: [RouterLink, MatIcon, MatProgressBar, IsoDatePipe, MoneyPipe],
  selector: 'app-goal-highlights',
  templateUrl: './goal-highlights.html',
  styleUrl: './goal-highlights.scss',
})
export class GoalHighlights {
  readonly items = input.required<readonly GoalWithProgress[]>();

  protected readonly statusLabels = GOAL_STATUS_LABELS;
  protected readonly statusIcons = GOAL_STATUS_ICONS;
  protected readonly progressBarValue = goalProgressBarValue;
}
