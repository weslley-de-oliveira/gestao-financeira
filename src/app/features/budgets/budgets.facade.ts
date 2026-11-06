import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { TODAY } from '../../core/services/today';
import { BudgetProgressRepository } from '../../data-access/repositories/budget-progress.repository';
import { BudgetRepository } from '../../data-access/repositories/budget.repository';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { Budget, BudgetProgress } from '../../shared/models/budget';
import { IsoMonth, toIsoMonth } from '../../shared/utils/month';
import {
  BudgetInput,
  InvalidBudgetInputError,
  normalizeBudgetInput,
  withLimitFrom,
} from './domain/budget-rules';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class BudgetNotFoundError extends Error {
  constructor() {
    super('Budget not found');
    this.name = 'BudgetNotFoundError';
  }
}

/** Já existe um orçamento para a categoria. */
export class DuplicateBudgetError extends Error {
  constructor(readonly existing: Budget) {
    super('There is already a budget for this category');
    this.name = 'DuplicateBudgetError';
  }
}

/**
 * Casos de uso dos orçamentos do usuário logado. O limite informado na criação ou na edição vale
 * do mês atual em diante; o consumo de cada mês vem calculado do repositório.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsFacade {
  private readonly repository = inject(BudgetRepository);
  private readonly progressRepository = inject(BudgetProgressRepository);
  private readonly categories = inject(CategoryRepository);
  private readonly auth = inject(AuthService);
  private readonly today = inject(TODAY);
  private readonly _budgets = signal<Budget[]>([]);
  private readonly _status = signal<LoadStatus>('loading');

  private readonly _progress = signal<BudgetProgress[]>([]);
  private readonly _progressStatus = signal<LoadStatus>('loading');
  /** Só a resposta do pedido mais recente vale (trocas rápidas de mês). */
  private latestProgress = 0;

  readonly budgets = this._budgets.asReadonly();
  readonly status = this._status.asReadonly();
  /** Consumo do mês carregado por `loadProgress`. */
  readonly progress = this._progress.asReadonly();
  readonly progressStatus = this._progressStatus.asReadonly();

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this._budgets.set([]);
      this._status.set('loading');
      this.latestProgress++;
      this._progress.set([]);
      this._progressStatus.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      this._budgets.set(await firstValueFrom(this.repository.listByUser(this.userId())));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se o orçamento não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<Budget | null> {
    const budget = await firstValueFrom(this.repository.findById(id));
    return budget && budget.userId === this.userId() ? budget : null;
  }

  async create(input: BudgetInput): Promise<Budget> {
    const normalized = normalizeBudgetInput(input);
    await this.assertCategory(normalized.categoryId);
    const budget: NewRecord<Budget> = {
      userId: this.userId(),
      categoryId: normalized.categoryId,
      limits: [{ month: this.currentMonth(), amount: normalized.limitAmount }],
      alertThreshold: normalized.alertThreshold,
    };
    return this.store(await firstValueFrom(this.repository.create(budget)));
  }

  /** A categoria não muda; o novo limite vale do mês atual em diante. */
  /** `version`: o `updatedAt` do registro quando o formulário o carregou. */
  async update(id: string, input: BudgetInput, version?: string): Promise<Budget> {
    const normalized = normalizeBudgetInput(input);
    const previous = await this.getOwned(id);
    if (normalized.categoryId !== previous.categoryId) {
      throw new InvalidBudgetInputError('categoryId');
    }
    const changes = {
      limits: withLimitFrom(previous.limits, this.currentMonth(), normalized.limitAmount),
      alertThreshold: normalized.alertThreshold,
    };
    return this.store(await firstValueFrom(this.repository.update(id, changes, version)));
  }

  /** O orçamento não guarda histórico próprio (o consumo vem das transações): pode ser excluído. */
  async delete(id: string): Promise<void> {
    await this.getOwned(id);
    await firstValueFrom(this.repository.delete(id));
    this._budgets.update((budgets) => budgets.filter((item) => item.id !== id));
    this._progress.update((progress) => progress.filter((item) => item.budget.id !== id));
  }

  /** Consumo dos orçamentos que valem no mês (na API, calculado pelo servidor). */
  async loadProgress(month: IsoMonth): Promise<void> {
    const request = ++this.latestProgress;
    this._progressStatus.set('loading');
    try {
      const progress = await firstValueFrom(
        this.progressRepository.listByMonth(this.userId(), month),
      );
      if (request === this.latestProgress) {
        this._progress.set(progress);
        this._progressStatus.set('ready');
      }
    } catch {
      if (request === this.latestProgress) {
        this._progressStatus.set('error');
      }
    }
  }

  /** Categoria de despesa ativa do usuário e ainda sem orçamento. */
  private async assertCategory(categoryId: string): Promise<void> {
    const userId = this.userId();
    const [categories, budgets] = await Promise.all([
      firstValueFrom(this.categories.listByUser(userId)),
      firstValueFrom(this.repository.listByUser(userId)),
    ]);
    const category = categories.find((item) => item.id === categoryId);
    if (!category || category.type !== 'expense' || category.isArchived) {
      throw new InvalidBudgetInputError('categoryId');
    }
    const existing = budgets.find((item) => item.categoryId === categoryId);
    if (existing) {
      throw new DuplicateBudgetError(existing);
    }
  }

  private async getOwned(id: string): Promise<Budget> {
    const budget = await this.getById(id);
    if (!budget) {
      throw new BudgetNotFoundError();
    }
    return budget;
  }

  private store(budget: Budget): Budget {
    this._budgets.update((budgets) =>
      budgets.some((item) => item.id === budget.id)
        ? budgets.map((item) => (item.id === budget.id ? budget : item))
        : [...budgets, budget],
    );
    return budget;
  }

  private currentMonth(): string {
    return toIsoMonth(this.today());
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
