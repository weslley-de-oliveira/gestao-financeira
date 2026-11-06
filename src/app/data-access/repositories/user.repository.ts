import { Observable } from 'rxjs';
import { PasswordHash } from '../../core/security/password-hasher';
import { User } from '../../shared/models/user';

export interface UserWithCredentials {
  user: User;
  passwordHash: PasswordHash;
}

/**
 * Contrato de acesso aos usuários da autenticação local (demo e testes). Na API, cadastro e login
 * ficam com o servidor (`ApiAuthGateway`).
 */
export abstract class UserRepository {
  /** `email` deve estar normalizado (sem espaços e em minúsculas). */
  abstract findByEmail(email: string): Observable<UserWithCredentials | null>;

  abstract create(record: UserWithCredentials): Observable<UserWithCredentials>;

  /** Atualiza só o nome: e-mail e senha são dados de autenticação, com fluxo próprio. */
  abstract updateName(id: string, name: string): Observable<User>;

  /** Grava o hash da senha nova (a troca de senha confere a atual antes). */
  abstract updatePasswordHash(id: string, passwordHash: PasswordHash): Observable<void>;
}
