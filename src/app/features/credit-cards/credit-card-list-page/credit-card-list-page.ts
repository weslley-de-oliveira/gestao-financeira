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
import { CARD_BRAND_LABELS, CreditCard } from '../../../shared/models/credit-card';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CreditCardArchiveAction } from '../credit-card-archive';
import { CreditCardsFacade } from '../credit-cards.facade';
import { usagePercent } from '../domain/card-usage';

type StatusFilter = 'active' | 'archived' | 'all';

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Ativos' },
  { value: 'archived', label: 'Arquivados' },
  { value: 'all', label: 'Todos' },
];

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
  selector: 'app-credit-card-list-page',
  templateUrl: './credit-card-list-page.html',
  styleUrl: './credit-card-list-page.scss',
})
export class CreditCardListPage implements OnInit {
  private readonly facade = inject(CreditCardsFacade);
  private readonly archiveAction = inject(CreditCardArchiveAction);

  private readonly filter = signal<{ status: StatusFilter }>({ status: 'active' });
  protected readonly filterForm = form(this.filter);

  protected readonly status = this.facade.status;
  protected readonly hasCards = computed(() => this.facade.cards().length > 0);
  protected readonly visibleCards = computed(() => {
    const { status } = this.filter();
    return this.facade
      .cards()
      .filter((card) => status === 'all' || card.isArchived === (status === 'archived'))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  });
  /** Totais dos cartões ativos. */
  protected readonly totals = computed(() =>
    this.facade
      .cards()
      .filter((card) => !card.isArchived)
      .reduce(
        (totals, card) => ({
          count: totals.count + 1,
          limit: totals.limit + card.creditLimit,
          available: totals.available + card.availableLimit,
        }),
        { count: 0, limit: 0, available: 0 },
      ),
  );

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly brandLabels = CARD_BRAND_LABELS;
  protected readonly usagePercent = usagePercent;

  ngOnInit(): void {
    void this.facade.load();
  }

  protected reload(): void {
    void this.facade.load();
  }

  protected showAll(): void {
    this.filter.set({ status: 'all' });
  }

  protected toggleArchived(card: CreditCard): void {
    void this.archiveAction.toggle(card);
  }
}
