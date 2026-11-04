import { Observable } from 'rxjs';
import { PasswordHash } from '../../core/security/password-hasher';
import { User } from '../../shared/models/user';

export interface UserWithCredentials {
  user: User;
  passwordHash: PasswordHash;
}

/** Contrato de acesso aos usuários. A implementação atual usa HTTP (JSON Server). */
export abstract class UserRepository {
  /** `email` deve estar normalizado (sem espaços e em minúsculas). */
  abstract findByEmail(email: string): Observable<UserWithCredentials | null>;

  abstract create(record: UserWithCredentials): Observable<UserWithCredentials>;
}
