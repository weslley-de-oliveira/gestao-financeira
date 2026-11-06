import { User } from '../../shared/models/user';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
}

/**
 * Onde a autenticação acontece. A implementação local (demo) confere a senha no navegador
 * e guarda a sessão criptografada; a da API usa a sessão em cookie do servidor.
 * O `AuthService` guarda só o usuário atual para as telas.
 */
export abstract class AuthGateway {
  /** Usuário da sessão ainda válida, ou `null`. Chamado ao abrir o app. */
  abstract restore(): Promise<User | null>;

  /** Credenciais erradas → `InvalidCredentialsError` (a mesma para e-mail e senha). */
  abstract login(credentials: LoginCredentials): Promise<User>;

  /** E-mail já cadastrado → `EmailAlreadyRegisteredError`. Já abre a sessão. */
  abstract register(data: RegistrationData): Promise<User>;

  abstract logout(): Promise<void>;

  /** Só o nome muda: e-mail e senha são dados de autenticação, com fluxo próprio. */
  abstract updateName(user: User, name: string): Promise<User>;

  /**
   * Apaga o usuário e todos os dados dele, confirmando com a senha atual (errada →
   * `IncorrectPasswordError`). Não pode ser desfeito.
   */
  abstract deleteAccount(user: User, password: string): Promise<void>;

  /**
   * Troca a senha, confirmando com a atual (errada → `IncorrectPasswordError`). Na API, a sessão
   * atual continua e as dos outros aparelhos são encerradas.
   */
  abstract changePassword(user: User, currentPassword: string, newPassword: string): Promise<void>;
}
