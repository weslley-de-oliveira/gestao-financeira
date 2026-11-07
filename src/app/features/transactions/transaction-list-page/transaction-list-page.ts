import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { injectIsMobile } from '../../../core/layout/breakpoints';
import { PeriodService } from '../../../core/services/period.service';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { PERIOD_OPTIONS } from '../../../shared/models/period';
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  Transaction,
  isCardRefund,
} from '../../../shared/models/transaction';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CategoriesFacade } from '../../categories/categories.facade';
import { CreditCardsFacade } from '../../credit-cards/credit-cards.facade';
import {
  ALL,
  TRANSACTION_QUERY_PARAMS,
  TRANSACTION_SORT_OPTIONS,
  defaultTransactionQuery,
  fromQueryParams,
  toQueryParams,
  toTransactionFilters,
} from '../domain/transaction-query';
import { TransactionActions } from '../transaction-actions';
import {
  TRANSACTION_SIGNS,
  TRANSACTION_TYPE_ICONS,
  accountLabel,
  byId,
  canChangeStatus,
  canDelete,
  categoryOf,
  installmentLabel,
  isEditable,
} from '../transaction-display';
import { TransactionListStore } from './transaction-list-store';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SEARCH_DELAY_MS = 300;

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
  providers: [TransactionListStore],
})
export class TransactionListPage implements OnInit {
  private readonly store = inject(TransactionListStore);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly period = inject(PeriodService);
  private readonly actions = inject(TransactionActions);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Filtros guardados na URL (`TRANSACTION_QUERY_PARAMS`), lidos ao abrir a tela. */
  readonly busca = input<string>();
  readonly tipo = input<string>();
  readonly conta = input<string>();
  readonly categoria = input<string>();
  readonly status = input<string>();
  readonly ordem = input<string>();
  /** Parâmetros dos links de outras telas que abrem a lista já filtrada (detalhe da conta etc.). */
  readonly accountId = input<string>();
  readonly creditCardId = input<string>();
  readonly categoryId = input<string>();

  protected readonly isMobile = injectIsMobile();
  protected readonly query = signal(defaultTransactionQuery());
  protected readonly filterForm = form(this.query);

  protected readonly loadStatus = computed(() => {
    const statuses = [
      this.store.status(),
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
  protected readonly hasTransactions = this.store.hasAny;
  protected readonly summary = this.store.totals;
  protected readonly page = this.store.items;
  protected readonly busy = this.store.busy;
  protected readonly pageIndex = this.store.pageIndex;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  private readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);

  /** A busca só vai ao servidor quando a pessoa para de digitar. */
  private readonly appliedSearch = signal('');
  private readonly cardIds = computed(
    () => new Set(this.creditCardsFacade.cards().map((card) => card.id)),
  );
  private readonly filters = computed(
    () =>
      toTransactionFilters(
        { ...this.query(), search: this.appliedSearch() },
        this.period.range(),
        (id) => this.cardIds().has(id),
      ),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly sort = computed(() => this.query().sort);

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

  constructor() {
    effect((onCleanup) => {
      const search = this.query().search;
      const timer = setTimeout(() => this.appliedSearch.set(search), SEARCH_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
    // Filtros, período, ordenação ou tamanho de página mudaram: nova consulta, na primeira página.
    effect(() => {
      const filters = this.filters();
      const sort = this.sort();
      const pageSize = this.pageSize();
      // Com um cartão escolhido, espera os cartões para saber que o id é de cartão.
      if (this.query().accountId !== ALL && this.creditCardsFacade.status() === 'loading') {
        return;
      }
      untracked(() => void this.store.searchFor(filters, sort, pageSize));
    });
    // Os filtros aplicados vão para a URL, sem criar entradas no histórico do navegador: voltar,
    // recarregar ou compartilhar o link mantém a mesma lista.
    effect(() => {
      const queryParams = toQueryParams({ ...this.query(), search: this.appliedSearch() });
      untracked(
        () =>
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams,
            queryParamsHandling: 'merge',
            replaceUrl: true,
          }),
      );
    });
  }

  ngOnInit(): void {
    // O filtro de conta também aceita um cartão (por exemplo, vindo do detalhe do cartão).
    const query = fromQueryParams({
      [TRANSACTION_QUERY_PARAMS.search]: this.busca(),
      [TRANSACTION_QUERY_PARAMS.type]: this.tipo(),
      [TRANSACTION_QUERY_PARAMS.accountId]: this.conta(),
      [TRANSACTION_QUERY_PARAMS.categoryId]: this.categoria(),
      [TRANSACTION_QUERY_PARAMS.status]: this.status(),
      [TRANSACTION_QUERY_PARAMS.sort]: this.ordem(),
      accountId: this.accountId(),
      creditCardId: this.creditCardId(),
      categoryId: this.categoryId(),
    });
    this.query.set(query);
    // A busca vinda da URL vale já na primeira consulta, sem esperar a digitação.
    this.appliedSearch.set(query.search);
    this.loadLookups();
  }

  protected reload(): void {
    this.loadLookups();
    void this.store.refresh();
  }

  protected clearFilters(): void {
    this.query.set(defaultTransactionQuery());
    this.appliedSearch.set('');
  }

  protected onPage(event: PageEvent): void {
    if (event.pageSize !== this.pageSize()) {
      this.pageSize.set(event.pageSize);
    } else {
      void this.store.goTo(event.pageIndex);
    }
  }

  private loadLookups(): void {
    void this.accountsFacade.load();
    void this.categoriesFacade.load();
    // Só fornece os nomes dos cartões; sem eles, as compras aparecem como "Cartão de crédito".
    void this.creditCardsFacade.load();
  }

  // Métodos tipados: as linhas do `mat-table` chegam ao template como `any`.
  protected typeIcon(transaction: Transaction): string {
    return TRANSACTION_TYPE_ICONS[transaction.type];
  }

  protected typeLabel(transaction: Transaction): string {
    if (isCardRefund(transaction)) {
      return 'Estorno · crédito na fatura';
    }
    const installment = installmentLabel(transaction);
    return installment
      ? `${TRANSACTION_TYPE_LABELS[transaction.type]} · ${installment}`
      : TRANSACTION_TYPE_LABELS[transaction.type];
  }

  protected installmentLabel(transaction: Transaction): string | null {
    return installmentLabel(transaction);
  }

  protected canDelete(transaction: Transaction): boolean {
    return canDelete(transaction);
  }

  protected sign(transaction: Transaction): string {
    return TRANSACTION_SIGNS[transaction.type];
  }

  protected canChangeStatus(transaction: Transaction): boolean {
    return canChangeStatus(transaction);
  }

  protected isEditable(transaction: Transaction): boolean {
    return isEditable(transaction);
  }

  protected async toggleStatus(transaction: Transaction): Promise<void> {
    if (await this.actions.toggleStatus(transaction)) {
      await this.store.refresh();
    }
  }

  protected async delete(transaction: Transaction): Promise<void> {
    if (await this.actions.delete(transaction)) {
      await this.store.refresh();
    }
  }
}
