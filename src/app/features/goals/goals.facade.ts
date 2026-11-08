import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { TODAY } from '../../core/services/today';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { GoalChanges, GoalRepository } from '../../data-access/repositories/goal.repository';
import { Goal, GoalWithProgress } from '../../shared/models/goal';
import { toIsoDate } from '../../shared/utils/date';
import {
  ContributionInput,
  GoalInput,
  InsufficientGoalBalanceError,
  InvalidGoalInputError,
  calculateGoalProgress,
  goalBalance,
  normalizeContributionInput,
  normalizeGoalInput,
} from './domain/goal-rules';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class GoalNotFoundError extends Error {
  constructor() {
    super('Goal not found');
    this.name = 'GoalNotFoundError';
  }
}

/**
 * Casos de uso das metas do usuário logado. Progresso, status e ritmo são calculados (não
 * persistidos). Aportes e retiradas podem indicar uma conta, cujo saldo muda como numa
 * transferência entre a conta e a meta.
 */
@Injectable({ providedIn: 'root' })
export class GoalsFacade {
  private readonly repository = inject(GoalRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly auth = inject(AuthService);
  private readonly today = inject(TODAY);
  private readonly _goals = signal<Goal[]>([]);
  private readonly _status = signal<LoadStatus>('loading');

  readonly status = this._status.asReadonly();
  readonly goals = computed(() => this._goals().map((goal) => this.withProgress(goal)));

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this._goals.set([]);
      this._status.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      this._goals.set(await firstValueFrom(this.repository.listByUser(this.userId())));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se a meta não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<GoalWithProgress | null> {
    const goal = await this.findOwned(id);
    return goal ? this.withProgress(goal) : null;
  }

  /** A data-limite, quando informada, não pode estar no passado. */
  async create(input: GoalInput): Promise<GoalWithProgress> {
    const normalized = normalizeGoalInput(input);
    this.assertDeadline(normalized.deadline);
    const goal: NewRecord<Goal> = {
      ...normalized,
      userId: this.userId(),
      contributions: [],
      isPaused: false,
      isArchived: false,
    };
    return this.store(await firstValueFrom(this.repository.create(goal)));
  }

  /**
   * Uma data-limite já vencida pode ser mantida, mas não definida de novo; o valor inicial não
   * pode deixar o acumulado negativo.
   */
  /** `version`: o `updatedAt` do registro quando o formulário o carregou. */
  async update(id: string, input: GoalInput, version?: string): Promise<GoalWithProgress> {
    const normalized = normalizeGoalInput(input);
    const previous = await this.getOwned(id);
    if (normalized.deadline !== previous.deadline) {
      this.assertDeadline(normalized.deadline);
    }
    if (goalBalance({ ...previous, initialAmount: normalized.initialAmount }) < 0) {
      throw new InsufficientGoalBalanceError();
    }
    return this.save(id, normalized, version);
  }

  async setPaused(id: string, isPaused: boolean): Promise<GoalWithProgress> {
    await this.getOwned(id);
    return this.save(id, { isPaused });
  }

  /** Arquivar preserva a meta e o histórico; ela só deixa de aparecer entre as ativas. */
  async setArchived(id: string, isArchived: boolean): Promise<GoalWithProgress> {
    await this.getOwned(id);
    return this.save(id, { isArchived });
  }

  /**
   * Retiradas não podem deixar o acumulado negativo. A conta, se houver, precisa ser da pessoa e
   * estar ativa.
   */
  async addContribution(id: string, input: ContributionInput): Promise<GoalWithProgress> {
    const normalized = normalizeContributionInput(input, this.todayIso());
    const goal = await this.getOwned(id);
    await this.assertAccount(normalized.accountId);
    if (goalBalance({ ...goal, contributions: [...goal.contributions, normalized] }) < 0) {
      throw new InsufficientGoalBalanceError();
    }
    return this.store(await firstValueFrom(this.repository.addContribution(goal, normalized)));
  }

  /** Excluir um aporte também não pode deixar o acumulado negativo. */
  async removeContribution(id: string, contributionId: string): Promise<GoalWithProgress> {
    const goal = await this.getOwned(id);
    if (!goal.contributions.some((item) => item.id === contributionId)) {
      throw new InvalidGoalInputError('amount');
    }
    const contributions = goal.contributions.filter((item) => item.id !== contributionId);
    if (goalBalance({ ...goal, contributions }) < 0) {
      throw new InsufficientGoalBalanceError();
    }
    return this.store(
      await firstValueFrom(this.repository.removeContribution(goal, contributionId)),
    );
  }

  private async assertAccount(accountId: string | null): Promise<void> {
    if (accountId === null) {
      return;
    }
    const account = await firstValueFrom(this.accounts.findById(accountId));
    if (!account || account.userId !== this.userId() || account.isArchived) {
      throw new InvalidGoalInputError('accountId');
    }
  }

  private assertDeadline(deadline: string | null): void {
    if (deadline !== null && deadline < this.todayIso()) {
      throw new InvalidGoalInputError('deadline');
    }
  }

  private async findOwned(id: string): Promise<Goal | null> {
    const goal = await firstValueFrom(this.repository.findById(id));
    return goal && goal.userId === this.userId() ? goal : null;
  }

  private async getOwned(id: string): Promise<Goal> {
    const goal = await this.findOwned(id);
    if (!goal) {
      throw new GoalNotFoundError();
    }
    return goal;
  }

  private async save(
    id: string,
    changes: GoalChanges,
    version?: string,
  ): Promise<GoalWithProgress> {
    return this.store(await firstValueFrom(this.repository.update(id, changes, version)));
  }

  private store(goal: Goal): GoalWithProgress {
    this._goals.update((goals) =>
      goals.some((item) => item.id === goal.id)
        ? goals.map((item) => (item.id === goal.id ? goal : item))
        : [...goals, goal],
    );
    return this.withProgress(goal);
  }

  private withProgress(goal: Goal): GoalWithProgress {
    return calculateGoalProgress(goal, this.todayIso());
  }

  private todayIso(): string {
    return toIsoDate(this.today());
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
