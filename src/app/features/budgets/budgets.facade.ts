import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { TODAY } from '../../core/services/period.service';
import { BudgetRepository } from '../../data-access/repositories/budget.repository';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { Budget } from '../../shared/models/budget';
import { toIsoMonth } from '../../shared/utils/month';
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
 * do mês atual em diante; o consumo é calculado na tela a partir das transações.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsFacade {
  private readonly repository = inject(BudgetRepository);
  private readonly categories = inject(CategoryRepository);
  private readonly auth = inject(AuthService);
  private readonly today = inject(TODAY);
  private readonly _budgets = signal<Budget[]>([]);
  private readonly _status = signal<LoadStatus>('loading');

  readonly budgets = this._budgets.asReadonly();
  readonly status = this._status.asReadonly();

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
    const budget: Budget = {
      id: crypto.randomUUID(),
      userId: this.userId(),
      categoryId: normalized.categoryId,
      limits: [{ month: this.currentMonth(), amount: normalized.limitAmount }],
      alertThreshold: normalized.alertThreshold,
      createdAt: new Date().toISOString(),
    };
    return this.store(await firstValueFrom(this.repository.create(budget)));
  }

  /** A categoria não muda; o novo limite vale do mês atual em diante. */
  async update(id: string, input: BudgetInput): Promise<Budget> {
    const normalized = normalizeBudgetInput(input);
    const previous = await this.getOwned(id);
    if (normalized.categoryId !== previous.categoryId) {
      throw new InvalidBudgetInputError('categoryId');
    }
    const changes = {
      limits: withLimitFrom(previous.limits, this.currentMonth(), normalized.limitAmount),
      alertThreshold: normalized.alertThreshold,
    };
    return this.store(await firstValueFrom(this.repository.update(id, changes)));
  }

  /** O orçamento não guarda histórico próprio (o consumo vem das transações): pode ser excluído. */
  async delete(id: string): Promise<void> {
    await this.getOwned(id);
    await firstValueFrom(this.repository.delete(id));
    this._budgets.update((budgets) => budgets.filter((item) => item.id !== id));
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
