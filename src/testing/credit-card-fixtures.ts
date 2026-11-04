import { TestBed } from '@angular/core/testing';
import { CreditCard } from '../app/shared/models/credit-card';
import { InMemoryCreditCardRepository } from './in-memory-credit-card.repository';

/** Grava cartões diretamente no repositório em memória (padrão: fecha dia 5, vence dia 12). */
export function seedCreditCards(userId: string, ...cards: Partial<CreditCard>[]): CreditCard[] {
  const repository = TestBed.inject(InMemoryCreditCardRepository);
  const records = cards.map((overrides, index): CreditCard => ({
    id: `card-${repository.records.length + index + 1}`,
    userId,
    name: `Cartão ${index + 1}`,
    brand: 'visa',
    lastFourDigits: '1234',
    creditLimit: 500_000,
    closingDay: 5,
    dueDay: 12,
    paymentAccountId: 'account-1',
    color: '#6a1b9a',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }));
  repository.records.push(...records);
  return records;
}
