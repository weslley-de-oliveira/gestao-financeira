import { TestBed } from '@angular/core/testing';
import { Category } from '../app/shared/models/category';
import { InMemoryCategoryRepository } from './in-memory-category.repository';

/** Grava categorias diretamente no repositório em memória. */
export function seedCategories(userId: string, ...categories: Partial<Category>[]): Category[] {
  const repository = TestBed.inject(InMemoryCategoryRepository);
  const records = categories.map((overrides, index): Category => ({
    id: `category-${repository.records.length + index + 1}`,
    userId,
    name: `Categoria ${index + 1}`,
    type: 'expense',
    icon: 'more_horiz',
    color: '#546e7a',
    isDefault: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }));
  repository.records.push(...records);
  return records;
}
