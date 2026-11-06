import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { TODAY } from '../../core/services/today';
import { GoalChanges, GoalRepository } from '../../data-access/repositories/goal.repository';
import { Goal, GoalContribution, GoalWithProgress } from '../../shared/models/goal';
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
 * persistidos); aportes e retiradas são manuais e não movimentam contas.
 */
@Injectable({ providedIn: 'root' })
export class GoalsFacade {
  private readonly repository = inject(GoalRepository);
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
  async update(id: string, input: GoalInput): Promise<GoalWithProgress> {
    const normalized = normalizeGoalInput(input);
    const previous = await this.getOwned(id);
    if (normalized.deadline !== previous.deadline) {
      this.assertDeadline(normalized.deadline);
    }
    if (goalBalance({ ...previous, initialAmount: normalized.initialAmount }) < 0) {
      throw new InsufficientGoalBalanceError();
    }
    return this.save(id, normalized);
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

  /** Retiradas não podem deixar o acumulado negativo. */
  async addContribution(id: string, input: ContributionInput): Promise<GoalWithProgress> {
    const normalized = normalizeContributionInput(input, this.todayIso());
    const goal = await this.getOwned(id);
    const contribution: GoalContribution = {
      ...normalized,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const contributions = [...goal.contributions, contribution];
    if (goalBalance({ ...goal, contributions }) < 0) {
      throw new InsufficientGoalBalanceError();
    }
    return this.save(id, { contributions });
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
    return this.save(id, { contributions });
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

  private async save(id: string, changes: GoalChanges): Promise<GoalWithProgress> {
    return this.store(await firstValueFrom(this.repository.update(id, changes)));
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
