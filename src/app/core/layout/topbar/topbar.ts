import { Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { PERIOD_OPTIONS, PeriodPreset } from '../../../shared/models/period';
import { PeriodService } from '../../services/period.service';
import { AppTitleStrategy } from '../app-title-strategy';

@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIcon,
    MatMenuModule,
    MatSelectModule,
    MatToolbar,
  ],
  selector: 'app-topbar',
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly periodService = inject(PeriodService);

  readonly menuToggle = output<void>();

  protected readonly pageTitle = inject(AppTitleStrategy).pageTitle;
  protected readonly selectedPeriod = this.periodService.selected;
  protected readonly periodOptions = PERIOD_OPTIONS;

  protected onPeriodChange(period: PeriodPreset): void {
    this.periodService.select(period);
  }
}
