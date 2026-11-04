import { TestBed } from '@angular/core/testing';
import { Budget } from '../app/shared/models/budget';
import { InMemoryBudgetRepository } from './in-memory-budget.repository';

/** Grava orçamentos diretamente no repositório em memória (padrão: R$ 500,00 desde 01/2026). */
export function seedBudgets(userId: string, ...budgets: Partial<Budget>[]): Budget[] {
  const repository = TestBed.inject(InMemoryBudgetRepository);
  const records = budgets.map((overrides, index): Budget => ({
    id: `budget-${repository.records.length + index + 1}`,
    userId,
    categoryId: `category-${index + 1}`,
    limits: [{ month: '2026-01', amount: 50_000 }],
    alertThreshold: 80,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }));
  repository.records.push(...records);
  return records;
}
