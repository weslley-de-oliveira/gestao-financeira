import { TestBed } from '@angular/core/testing';
import { AuthService } from '../app/core/auth/auth.service';
import { Account } from '../app/shared/models/account';
import { InMemoryAccountRepository } from './in-memory-account.repository';

/** Cadastra e autentica a usuária fictícia usada nos testes; retorna o id dela. */
export async function signInTestUser(): Promise<string> {
  const auth = TestBed.inject(AuthService);
  await auth.register({ name: 'Ana Teste', email: 'ana@exemplo.com', password: 'senha123' });
  return auth.currentUser()?.id ?? '';
}

/** Grava contas diretamente no repositório em memória. */
export function seedAccounts(userId: string, ...accounts: Partial<Account>[]): Account[] {
  const repository = TestBed.inject(InMemoryAccountRepository);
  const records = accounts.map((overrides, index): Account => ({
    id: `account-${index + 1}`,
    userId,
    name: `Conta ${index + 1}`,
    type: 'checking',
    institution: null,
    initialBalance: 0,
    color: '#1565c0',
    icon: 'account_balance',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }));
  repository.records.push(...records);
  return records;
}
