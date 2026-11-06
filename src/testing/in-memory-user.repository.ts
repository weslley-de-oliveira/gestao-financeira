import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  UserRepository,
  UserWithCredentials,
} from '../app/data-access/repositories/user.repository';
import { PasswordHash } from '../app/core/security/password-hasher';
import { User } from '../app/shared/models/user';

/** Repositório de usuários em memória, para testes sem API. */
@Injectable()
export class InMemoryUserRepository extends UserRepository {
  readonly records: UserWithCredentials[] = [];

  findByEmail(email: string): Observable<UserWithCredentials | null> {
    return of(this.records.find((record) => record.user.email === email) ?? null);
  }

  create(record: UserWithCredentials): Observable<UserWithCredentials> {
    this.records.push(record);
    return of(record);
  }

  updateName(id: string, name: string): Observable<User> {
    const record = this.records.find((item) => item.user.id === id);
    if (!record) {
      return throwError(() => new Error(`User ${id} not found`));
    }
    record.user = { ...record.user, name };
    return of({ ...record.user });
  }

  updatePasswordHash(id: string, passwordHash: PasswordHash): Observable<void> {
    const record = this.records.find((item) => item.user.id === id);
    if (!record) {
      return throwError(() => new Error(`User ${id} not found`));
    }
    record.passwordHash = passwordHash;
    return of(undefined);
  }
}
