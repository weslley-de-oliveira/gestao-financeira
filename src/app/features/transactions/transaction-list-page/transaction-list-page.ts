import { Component, OnInit, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { injectIsMobile } from '../../../core/layout/breakpoints';
import { PeriodService } from '../../../core/services/period.service';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { PERIOD_OPTIONS } from '../../../shared/models/period';
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
import {
  TRANSACTION_SORT_OPTIONS,
  defaultTransactionQuery,
  queryTransactions,
} from '../domain/transaction-query';
import { isCardPurchase, summarizeTransactions } from '../domain/transaction-rules';
import { TransactionActions } from '../transaction-actions';
import {
  TRANSACTION_SIGNS,
  TRANSACTION_TYPE_ICONS,
  accountLabel,
  byId,
  categoryOf,
} from '../transaction-display';
import { TransactionsFacade } from '../transactions.facade';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatMenuModule,
    MatPaginator,
    MatProgressBar,
    MatSelectModule,
    MatTableModule,
    IconAvatar,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-transaction-list-page',
  templateUrl: './transaction-list-page.html',
  styleUrl: './transaction-list-page.scss',
})
export class TransactionListPage implements OnInit {
  private readonly facade = inject(TransactionsFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly period = inject(PeriodService);
  private readonly actions = inject(TransactionActions);

  /** Query params opcionais que pré-filtram a lista (por exemplo, vindo do detalhe da conta). */
  readonly accountId = input<string>();
  readonly creditCardId = input<string>();
  readonly categoryId = input<string>();

  protected readonly isMobile = injectIsMobile();
  protected readonly query = signal(defaultTransactionQuery());
  protected readonly filterForm = form(this.query);

  protected readonly status = computed(() => {
    const statuses = [
      this.facade.status(),
      this.accountsFacade.status(),
      this.categoriesFacade.status(),
    ];
    return statuses.includes('error')
      ? 'error'
      : statuses.includes('loading')
        ? 'loading'
        : 'ready';
  });
  protected readonly periodLabel = computed(
    () => PERIOD_OPTIONS.find((option) => option.value === this.period.selected())?.label ?? '',
  );
  protected readonly lookups = computed(() => ({
    accounts: byId(this.accountsFacade.accounts()),
    categories: byId(this.categoriesFacade.categories()),
    creditCards: byId(this.creditCardsFacade.cards()),
  }));
  protected readonly hasTransactions = computed(() => this.facade.transactions().length > 0);
  protected readonly filtered = computed(() =>
    queryTransactions(this.facade.transactions(), this.query(), this.period.range()),
  );
  protected readonly summary = computed(() => summarizeTransactions(this.filtered()));

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  /** Volta à primeira página quando filtros ou período mudam. */
  protected readonly pageIndex = linkedSignal({
    source: () => [this.query(), this.period.range()],
    computation: () => 0,
  });
  protected readonly page = computed(() => {
    const items = this.filtered();
    const lastPage = Math.max(0, Math.ceil(items.length / this.pageSize()) - 1);
    const start = Math.min(this.pageIndex(), lastPage) * this.pageSize();
    return items.slice(start, start + this.pageSize());
  });

  protected readonly accountOptions = computed(() =>
    [...this.accountsFacade.accounts()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );
  protected readonly creditCardOptions = computed(() =>
    [...this.creditCardsFacade.cards()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );
  protected readonly categoryGroups = computed(() => {
    const sorted = [...this.categoriesFacade.categories()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    return [
      { label: 'Despesas', categories: sorted.filter((c) => c.type === 'expense') },
      { label: 'Receitas', categories: sorted.filter((c) => c.type === 'income') },
    ];
  });

  protected readonly columns = [
    'date',
    'description',
    'category',
    'account',
    'status',
    'amount',
    'actions',
  ];
  protected readonly statusLabels = TRANSACTION_STATUS_LABELS;
  protected readonly sortOptions = TRANSACTION_SORT_OPTIONS;
  protected readonly accountLabel = accountLabel;
  protected readonly categoryOf = categoryOf;

  ngOnInit(): void {
    // O filtro de conta também aceita um cartão (por exemplo, vindo do detalhe do cartão).
    const accountId = this.accountId() ?? this.creditCardId();
    const categoryId = this.categoryId();
    this.query.update((query) => ({
      ...query,
      accountId: accountId ?? query.accountId,
      categoryId: categoryId ?? query.categoryId,
    }));
    this.reload();
  }

  protected reload(): void {
    void this.facade.load();
    void this.accountsFacade.load();
    void this.categoriesFacade.load();
    // Só fornece os nomes dos cartões; sem eles, as compras aparecem como "Cartão de crédito".
    void this.creditCardsFacade.load();
  }

  protected clearFilters(): void {
    this.query.set(defaultTransactionQuery());
  }

  protected onPage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  // Métodos tipados: as linhas do `mat-table` chegam ao template como `any`.
  protected typeIcon(transaction: Transaction): string {
    return TRANSACTION_TYPE_ICONS[transaction.type];
  }

  protected typeLabel(transaction: Transaction): string {
    return TRANSACTION_TYPE_LABELS[transaction.type];
  }

  protected sign(transaction: Transaction): string {
    return TRANSACTION_SIGNS[transaction.type];
  }

  protected isCardPurchase(transaction: Transaction): boolean {
    return isCardPurchase(transaction);
  }

  protected toggleStatus(transaction: Transaction): void {
    void this.actions.toggleStatus(transaction);
  }

  protected delete(transaction: Transaction): void {
    void this.actions.delete(transaction);
  }
}
