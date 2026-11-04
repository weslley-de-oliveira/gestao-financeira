import { Provider } from '@angular/core';
import { PBKDF2_ITERATIONS } from '../app/core/security/password-hasher';
import { UserRepository } from '../app/data-access/repositories/user.repository';
import { InMemoryUserRepository } from './in-memory-user.repository';

/** Substitui o JSON Server por memória e reduz as iterações do PBKDF2 para acelerar os testes. */
export const TEST_PROVIDERS: Provider[] = [
  InMemoryUserRepository,
  { provide: UserRepository, useExisting: InMemoryUserRepository },
  { provide: PBKDF2_ITERATIONS, useValue: 1_000 },
];
