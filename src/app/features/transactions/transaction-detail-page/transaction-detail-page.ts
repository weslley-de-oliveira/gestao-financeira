import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  Transaction,
} from '../../../shared/models/transaction';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CategoriesFacade } from '../../categories/categories.facade';
import { CreditCardsFacade } from '../../credit-cards/credit-cards.facade';
import { isCardPurchase } from '../domain/transaction-rules';
import { TransactionActions } from '../transaction-actions';
import {
  TRANSACTION_SIGNS,
  TRANSACTION_TYPE_ICONS,
  accountLabel,
  byId,
  categoryOf,
} from '../transaction-display';
import { TransactionsFacade } from '../transactions.facade';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatProgressBar,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-transaction-detail-page',
  templateUrl: './transaction-detail-page.html',
  styleUrl: './transaction-detail-page.scss',
})
export class TransactionDetailPage implements OnInit {
  private readonly facade = inject(TransactionsFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly actions = inject(TransactionActions);
  private readonly router = inject(Router);

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly transaction = signal<Transaction | null>(null);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly lookups = computed(() => ({
    accounts: byId(this.accountsFacade.accounts()),
    categories: byId(this.categoriesFacade.categories()),
    creditCards: byId(this.creditCardsFacade.cards()),
  }));
  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly typeIcons = TRANSACTION_TYPE_ICONS;
  protected readonly statusLabels = TRANSACTION_STATUS_LABELS;
  protected readonly signs = TRANSACTION_SIGNS;
  protected readonly accountLabel = accountLabel;
  protected readonly categoryOf = categoryOf;
  protected readonly isCardPurchase = isCardPurchase;

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const [transaction] = await Promise.all([
        this.facade.getById(this.id()),
        this.accountsFacade.load(),
        this.categoriesFacade.load(),
        this.creditCardsFacade.load(),
      ]);
      this.transaction.set(transaction);
      this.loadState.set(transaction ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }

  protected async toggleStatus(transaction: Transaction): Promise<void> {
    const updated = await this.actions.toggleStatus(transaction);
    if (updated) {
      this.transaction.set(updated);
    }
  }

  protected async delete(transaction: Transaction): Promise<void> {
    if (await this.actions.delete(transaction)) {
      await this.router.navigateByUrl('/transactions');
    }
  }
}
