import { Provider } from '@angular/core';
import { PBKDF2_ITERATIONS } from '../app/core/security/password-hasher';
import { AccountRepository } from '../app/data-access/repositories/account.repository';
import { CategoryRepository } from '../app/data-access/repositories/category.repository';
import { UserRepository } from '../app/data-access/repositories/user.repository';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryCategoryRepository } from './in-memory-category.repository';
import { InMemoryUserRepository } from './in-memory-user.repository';

/** Substitui o JSON Server por memória e reduz as iterações do PBKDF2 para acelerar os testes. */
export const TEST_PROVIDERS: Provider[] = [
  InMemoryUserRepository,
  { provide: UserRepository, useExisting: InMemoryUserRepository },
  InMemoryAccountRepository,
  { provide: AccountRepository, useExisting: InMemoryAccountRepository },
  InMemoryCategoryRepository,
  { provide: CategoryRepository, useExisting: InMemoryCategoryRepository },
  { provide: PBKDF2_ITERATIONS, useValue: 1_000 },
];
