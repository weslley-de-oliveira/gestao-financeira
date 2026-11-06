import { Injectable, PendingTasks, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { DashboardRepository } from '../../data-access/repositories/dashboard.repository';
import { DashboardData } from '../../shared/models/dashboard';
import { DateRange } from '../../shared/models/period';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Resumo do dashboard da pessoa logada para o período escolhido. */
@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private readonly repository = inject(DashboardRepository);
  private readonly auth = inject(AuthService);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly _data = signal<DashboardData | null>(null);
  private readonly _status = signal<LoadStatus>('loading');
  /** Só a resposta do pedido mais recente vale (trocas rápidas de período). */
  private latest = 0;

  readonly data = this._data.asReadonly();
  readonly status = this._status.asReadonly();

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this.latest++;
      this._data.set(null);
      this._status.set('loading');
    });
  }

  /** A carga conta como tarefa pendente: a página só fica estável com os dados na tela. */
  async load(range: DateRange): Promise<void> {
    const done = this.pendingTasks.add();
    try {
      await this.fetch(range);
    } finally {
      done();
    }
  }

  private async fetch(range: DateRange): Promise<void> {
    const request = ++this.latest;
    this._status.set('loading');
    try {
      const data = await firstValueFrom(this.repository.load(this.userId(), range));
      if (request === this.latest) {
        this._data.set(data);
        this._status.set('ready');
      }
    } catch {
      if (request === this.latest) {
        this._status.set('error');
      }
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
