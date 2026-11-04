import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  UserRepository,
  UserWithCredentials,
} from '../app/data-access/repositories/user.repository';

/** Repositório de usuários em memória, para testes sem JSON Server. */
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
}
