import { TestBed } from '@angular/core/testing';
import { Goal } from '../app/shared/models/goal';
import { InMemoryGoalRepository } from './in-memory-goal.repository';

/** Grava metas diretamente no repositório em memória (padrão: alvo de R$ 10.000,00, sem prazo). */
export function seedGoals(userId: string, ...goals: Partial<Goal>[]): Goal[] {
  const repository = TestBed.inject(InMemoryGoalRepository);
  const records = goals.map((overrides, index): Goal => ({
    id: `goal-${repository.records.length + index + 1}`,
    userId,
    name: `Meta ${index + 1}`,
    description: null,
    targetAmount: 1_000_000,
    initialAmount: 0,
    contributions: [],
    deadline: null,
    color: '#2e7d32',
    icon: 'savings',
    isPaused: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }));
  repository.records.push(...records);
  return records;
}
