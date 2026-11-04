import { TestBed } from '@angular/core/testing';
import { Transaction } from '../app/shared/models/transaction';
import { InMemoryTransactionRepository } from './in-memory-transaction.repository';

/** Grava transações diretamente no repositório em memória (padrão: despesa realizada). */
export function seedTransactions(
  userId: string,
  ...transactions: Partial<Transaction>[]
): Transaction[] {
  const repository = TestBed.inject(InMemoryTransactionRepository);
  const records = transactions.map((overrides, index): Transaction => ({
    id: `transaction-${repository.records.length + index + 1}`,
    userId,
    type: 'expense',
    description: `Transação ${index + 1}`,
    amount: 1_000,
    date: '2026-11-10',
    accountId: 'account-1',
    destinationAccountId: null,
    categoryId: 'category-1',
    status: 'completed',
    notes: null,
    createdAt: `2026-11-10T10:00:0${index}.000Z`,
    ...overrides,
  }));
  repository.records.push(...records);
  return records;
}
