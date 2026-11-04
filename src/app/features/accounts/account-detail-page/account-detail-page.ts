import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ACCOUNT_TYPE_LABELS, AccountWithBalance } from '../../../shared/models/account';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountArchiveAction } from '../account-archive';
import { AccountsFacade } from '../accounts.facade';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatProgressBar,
    IconAvatar,
    MoneyPipe,
  ],
  selector: 'app-account-detail-page',
  templateUrl: './account-detail-page.html',
  styleUrl: './account-detail-page.scss',
})
export class AccountDetailPage implements OnInit {
  private readonly facade = inject(AccountsFacade);
  private readonly archiveAction = inject(AccountArchiveAction);

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly account = signal<AccountWithBalance | null>(null);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const account = await this.facade.getById(this.id());
      this.account.set(account);
      this.loadState.set(account ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }

  protected async toggleArchived(account: AccountWithBalance): Promise<void> {
    const updated = await this.archiveAction.toggle(account);
    if (updated) {
      this.account.set(updated);
    }
  }
}
