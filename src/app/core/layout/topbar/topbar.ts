import { Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbar } from '@angular/material/toolbar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { PERIOD_OPTIONS, PeriodPreset } from '../../../shared/models/period';
import { AuthService } from '../../auth/auth.service';
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly menuToggle = output<void>();

  protected readonly currentUser = this.auth.currentUser;
  protected readonly pageTitle = inject(AppTitleStrategy).pageTitle;
  protected readonly selectedPeriod = this.periodService.selected;
  protected readonly periodOptions = PERIOD_OPTIONS;

  protected onPeriodChange(period: PeriodPreset): void {
    this.periodService.select(period);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
    this.snackBar.open('Sessão encerrada.', 'Fechar', { duration: 4000 });
  }
}
