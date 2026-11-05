import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { User } from '../../shared/models/user';
import { toUserDto, toUserWithCredentials } from '../dto/user.dto';
import { UserRepository, UserWithCredentials } from '../repositories/user.repository';
import { LocalDatabase, LocalRecordNotFoundError } from './local-database';

/** Usuários da demonstração, no `localStorage`: só o hash da senha é guardado, nunca a senha. */
@Injectable()
export class LocalUserRepository extends UserRepository {
  private readonly database = inject(LocalDatabase);

  findByEmail(email: string): Observable<UserWithCredentials | null> {
    return defer(async () => {
      const users = await this.database.read('users');
      const dto = users.find((user) => user.email === email);
      return dto ? toUserWithCredentials(dto) : null;
    });
  }

  create(record: UserWithCredentials): Observable<UserWithCredentials> {
    return defer(async () => {
      const dto = toUserDto(record);
      await this.database.mutate('users', (users) => users.push(dto));
      return toUserWithCredentials(structuredClone(dto));
    });
  }

  updateName(id: string, name: string): Observable<User> {
    return defer(async () => {
      const dto = await this.database.mutate('users', (users) => {
        const user = users.find((item) => item.id === id);
        if (!user) {
          throw new LocalRecordNotFoundError('users', id);
        }
        user.name = name;
        return user;
      });
      return toUserWithCredentials(dto).user;
    });
  }
}
