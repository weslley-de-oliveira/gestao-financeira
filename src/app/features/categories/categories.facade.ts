import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { Category } from '../../shared/models/category';
import {
  CategoryInput,
  CategoryUpdate,
  DuplicateCategoryNameError,
  findDuplicateCategory,
  normalizeCategoryInput,
} from './domain/category-rules';
import { DEFAULT_CATEGORIES } from './domain/default-categories';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class CategoryNotFoundError extends Error {
  constructor() {
    super('Category not found');
    this.name = 'CategoryNotFoundError';
  }
}

/**
 * Casos de uso das categorias do usuário logado. No primeiro acesso, cria o conjunto padrão.
 * O sinal `categories` também alimenta o seletor de categoria das transações.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesFacade {
  private readonly repository = inject(CategoryRepository);
  private readonly auth = inject(AuthService);
  private readonly _categories = signal<Category[]>([]);
  private readonly _status = signal<LoadStatus>('loading');
  /** Criação do conjunto padrão por usuário: evita duplicá-lo com carregamentos simultâneos. */
  private readonly seeding = new Map<string, Promise<Category[]>>();

  readonly categories = this._categories.asReadonly();
  readonly status = this._status.asReadonly();

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this._categories.set([]);
      this.seeding.clear();
      this._status.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      this._categories.set(await this.listWithDefaults());
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se a categoria não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<Category | null> {
    const category = await firstValueFrom(this.repository.findById(id));
    return category && category.userId === this.userId() ? category : null;
  }

  async create(input: CategoryInput): Promise<Category> {
    const normalized = normalizeCategoryInput(input);
    await this.ensureUniqueName(normalized);
    const category: NewRecord<Category> = {
      ...normalized,
      userId: this.userId(),
      isDefault: false,
    };
    return this.store(await firstValueFrom(this.repository.create(category)));
  }

  async update(id: string, changes: CategoryUpdate): Promise<Category> {
    const normalized = normalizeCategoryInput(changes);
    const current = await this.getOwned(id);
    await this.ensureUniqueName({ name: normalized.name, type: current.type }, id);
    const { name, icon, color, isArchived } = normalized;
    return this.store(
      await firstValueFrom(this.repository.update(id, { name, icon, color, isArchived })),
    );
  }

  /** Arquivar preserva a categoria nas transações já registradas; ela só sai das opções. */
  async setArchived(id: string, isArchived: boolean): Promise<Category> {
    await this.getOwned(id);
    return this.store(await firstValueFrom(this.repository.update(id, { isArchived })));
  }

  private async listWithDefaults(): Promise<Category[]> {
    const userId = this.userId();
    const categories = await firstValueFrom(this.repository.listByUser(userId));
    // Como categorias nunca são excluídas, uma lista vazia significa primeiro acesso.
    if (categories.length > 0) {
      return categories;
    }
    let seeding = this.seeding.get(userId);
    if (!seeding) {
      seeding = this.createDefaults(userId);
      this.seeding.set(userId, seeding);
      // Se falhar, permite tentar de novo no próximo carregamento.
      seeding.catch(() => this.seeding.delete(userId));
    }
    return seeding;
  }

  private createDefaults(userId: string): Promise<Category[]> {
    return Promise.all(
      DEFAULT_CATEGORIES.map((item) =>
        firstValueFrom(
          this.repository.create({ ...item, userId, isDefault: true, isArchived: false }),
        ),
      ),
    );
  }

  private async ensureUniqueName(
    candidate: Pick<Category, 'name' | 'type'>,
    exceptId?: string,
  ): Promise<void> {
    const categories = await firstValueFrom(this.repository.listByUser(this.userId()));
    const duplicate = findDuplicateCategory(categories, candidate, exceptId);
    if (duplicate) {
      throw new DuplicateCategoryNameError(duplicate);
    }
  }

  private async getOwned(id: string): Promise<Category> {
    const category = await this.getById(id);
    if (!category) {
      throw new CategoryNotFoundError();
    }
    return category;
  }

  private store(category: Category): Category {
    this._categories.update((categories) =>
      categories.some((item) => item.id === category.id)
        ? categories.map((item) => (item.id === category.id ? category : item))
        : [...categories, category],
    );
    return category;
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
