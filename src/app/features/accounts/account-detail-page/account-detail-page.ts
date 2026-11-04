import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ACCOUNT_TYPE_LABELS, AccountWithBalance } from '../../../shared/models/account';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountArchiveAction } from '../account-archive';
import { TransactionsFacade } from '../../transactions/transactions.facade';
import { signForAccount } from '../../transactions/transaction-display';
import { AccountsFacade } from '../accounts.facade';

/** Quantidade de transações recentes exibidas no detalhe. */
const RECENT_TRANSACTIONS = 5;

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatProgressBar,
    IconAvatar,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-account-detail-page',
  templateUrl: './account-detail-page.html',
  styleUrl: './account-detail-page.scss',
})
export class AccountDetailPage implements OnInit {
  private readonly facade = inject(AccountsFacade);
  private readonly archiveAction = inject(AccountArchiveAction);
  private readonly transactionsFacade = inject(TransactionsFacade);

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly account = signal<AccountWithBalance | null>(null);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  /** Transações em que a conta é origem ou destino, das mais recentes para as mais antigas. */
  private readonly linkedTransactions = computed(() =>
    this.transactionsFacade
      .transactions()
      .filter((t) => t.accountId === this.id() || t.destinationAccountId === this.id())
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
  );
  protected readonly recentTransactions = computed(() =>
    this.linkedTransactions().slice(0, RECENT_TRANSACTIONS),
  );
  protected readonly linkedCount = computed(() => this.linkedTransactions().length);
  protected readonly signForAccount = signForAccount;

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const [account] = await Promise.all([
        this.facade.getById(this.id()),
        this.transactionsFacade.load(),
      ]);
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
