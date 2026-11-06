import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { CARD_BRAND_LABELS, CreditCardWithUsage } from '../../../shared/models/credit-card';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { Transaction } from '../../../shared/models/transaction';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { TransactionsFacade } from '../../transactions/transactions.facade';
import { CreditCardArchiveAction } from '../credit-card-archive';
import { CreditCardsFacade } from '../credit-cards.facade';
import { usagePercent } from '../domain/card-usage';

/** Quantidade de compras recentes exibidas no detalhe. */
const RECENT_PURCHASES = 5;

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
  selector: 'app-credit-card-detail-page',
  templateUrl: './credit-card-detail-page.html',
  styleUrl: './credit-card-detail-page.scss',
})
export class CreditCardDetailPage implements OnInit {
  private readonly facade = inject(CreditCardsFacade);
  private readonly archiveAction = inject(CreditCardArchiveAction);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly transactionsFacade = inject(TransactionsFacade);

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly card = signal<CreditCardWithUsage | null>(null);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly brandLabels = CARD_BRAND_LABELS;
  protected readonly usagePercent = usagePercent;

  /** Compras (e pagamentos de fatura) mais recentes do cartão. */
  protected readonly recentPurchases = signal<Transaction[]>([]);
  protected readonly purchaseCount = signal(0);
  protected readonly paymentAccountName = computed(() => {
    const id = this.card()?.paymentAccountId;
    return this.accountsFacade.accounts().find((account) => account.id === id)?.name ?? '—';
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const [card, purchases] = await Promise.all([
        this.facade.getById(this.id()),
        this.transactionsFacade.recent({ creditCardId: this.id() }, RECENT_PURCHASES),
        this.accountsFacade.load(),
      ]);
      this.card.set(card);
      this.recentPurchases.set(purchases.items);
      this.purchaseCount.set(purchases.count);
      this.loadState.set(card ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }

  protected async toggleArchived(card: CreditCardWithUsage): Promise<void> {
    const updated = await this.archiveAction.toggle(card);
    if (updated) {
      this.card.set(updated);
    }
  }
}
