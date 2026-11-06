import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { TransactionRepository } from '../../../data-access/repositories/transaction.repository';
import { Transaction } from '../../../shared/models/transaction';
import {
  TransactionFilters,
  TransactionSort,
  TransactionTotals,
} from '../../../shared/models/transaction-query';

export type ListStatus = 'loading' | 'ready' | 'error';

const EMPTY_TOTALS: TransactionTotals = {
  count: 0,
  income: 0,
  expense: 0,
  net: 0,
  pendingCount: 0,
};

interface Search {
  filters: TransactionFilters;
  sort: TransactionSort;
  pageSize: number;
}

/**
 * Estado da listagem de transações: uma página por vez, pedida ao repositório (na API, ao
 * servidor), e os totais de todo o resultado filtrado. A paginação é por cursor: a página
 * seguinte usa o cursor devolvido pela atual, e as anteriores, os cursores já visitados.
 */
@Injectable()
export class TransactionListStore {
  private readonly repository = inject(TransactionRepository);
  private readonly auth = inject(AuthService);
  private readonly pendingTasks = inject(PendingTasks);

  private readonly _items = signal<Transaction[]>([]);
  private readonly _totals = signal<TransactionTotals>(EMPTY_TOTALS);
  private readonly _hasAny = signal(false);
  private readonly _status = signal<ListStatus>('loading');
  private readonly _busy = signal(false);
  private readonly _pageIndex = signal(0);
  private readonly _search = signal<Search | null>(null);
  /** Cursor de cada página visitada; o da primeira é `null`. */
  private cursors: (string | null)[] = [null];
  private nextCursor: string | null = null;
  /** Só a resposta do pedido mais recente vale (digitação e cliques rápidos). */
  private latest = 0;
  /** Filtros dos totais exibidos e se `hasAny` já foi carregado. */
  private totalsKey: string | null = null;
  private hasAnyLoaded = false;

  readonly items = this._items.asReadonly();
  readonly totals = this._totals.asReadonly();
  /** Se a pessoa tem alguma transação, em qualquer período e filtro. */
  readonly hasAny = this._hasAny.asReadonly();
  /** `loading` só até a primeira resposta; depois, as recargas aparecem em `busy`. */
  readonly status = this._status.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly pageIndex = this._pageIndex.asReadonly();
  readonly pageSize = computed(() => this._search()?.pageSize ?? 0);

  /** Nova consulta (filtros, ordenação ou tamanho de página): volta à primeira página. */
  async searchFor(
    filters: TransactionFilters,
    sort: TransactionSort,
    pageSize: number,
  ): Promise<void> {
    this.setSearch({ filters, sort, pageSize });
    await this.fetch(0, null);
  }

  /** Vai para a página anterior ou seguinte (o paginador anda uma página por vez). */
  async goTo(pageIndex: number): Promise<void> {
    if (!this._search() || pageIndex === this._pageIndex()) {
      return;
    }
    const cursor =
      pageIndex === this._pageIndex() + 1 ? this.nextCursor : (this.cursors[pageIndex] ?? null);
    if (pageIndex > this._pageIndex()) {
      this.cursors[pageIndex] = cursor;
    }
    await this.fetch(pageIndex, cursor);
  }

  /** Recarrega a página atual e os totais (depois de alterar ou excluir uma transação). */
  async refresh(): Promise<void> {
    if (!this._search()) {
      return;
    }
    const index = this._pageIndex();
    await this.fetch(index, this.cursors[index] ?? null, { reloadTotals: true });
    // A página ficou vazia (a última transação dela saiu): volta uma página.
    if (this._items().length === 0 && index > 0) {
      await this.fetch(index - 1, this.cursors[index - 1] ?? null);
    }
  }

  private setSearch(search: Search): void {
    this._search.set(search);
    this.cursors = [null];
    this.nextCursor = null;
  }

  private async fetch(
    pageIndex: number,
    cursor: string | null,
    { reloadTotals = false } = {},
  ): Promise<void> {
    const search = this._search();
    if (!search) {
      return;
    }
    // Pede os totais que a tela ainda não mostra; uma resposta descartada não conta como mostrada.
    const totalsKey = filtersKey(search.filters);
    const also = {
      totals: reloadTotals || totalsKey !== this.totalsKey,
      hasAny: reloadTotals || !this.hasAnyLoaded,
    };
    const request = ++this.latest;
    const done = this.pendingTasks.add();
    this._busy.set(true);
    try {
      const userId = this.userId();
      const [page, totals, everything] = await Promise.all([
        firstValueFrom(
          this.repository.query(userId, {
            filters: search.filters,
            sort: search.sort,
            cursor,
            limit: search.pageSize,
          }),
        ),
        also.totals ? firstValueFrom(this.repository.summarize(userId, search.filters)) : null,
        also.hasAny ? firstValueFrom(this.repository.summarize(userId, {})) : null,
      ]);
      if (request !== this.latest) {
        return;
      }
      this._items.set(page.items);
      this.nextCursor = page.nextCursor;
      this._pageIndex.set(pageIndex);
      if (totals) {
        this._totals.set(totals);
        this.totalsKey = totalsKey;
      }
      if (everything) {
        this._hasAny.set(everything.count > 0);
        this.hasAnyLoaded = true;
      }
      this._status.set('ready');
    } catch {
      if (request === this.latest) {
        this._status.set('error');
      }
    } finally {
      if (request === this.latest) {
        this._busy.set(false);
      }
      done();
    }
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}

function filtersKey(filters: TransactionFilters): string {
  return JSON.stringify(filters);
}
