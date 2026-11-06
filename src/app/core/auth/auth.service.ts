import { Injectable, computed, inject, signal } from '@angular/core';
import { USER_NAME_MAX_LENGTH, User } from '../../shared/models/user';
import { PreferencesService } from '../preferences/preferences.service';
import { AuthGateway, LoginCredentials, RegistrationData } from './auth.gateway';
import { SessionCleanup } from './session-cleanup';

export type { LoginCredentials, RegistrationData } from './auth.gateway';

/**
 * Usuário atual das telas. A autenticação em si fica no `AuthGateway`: local (demo)
 * ou a API, conforme os providers de dados da build.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gateway = inject(AuthGateway);
  private readonly preferences = inject(PreferencesService);
  private readonly cleanup = inject(SessionCleanup);
  private readonly _currentUser = signal<User | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  async restoreSession(): Promise<void> {
    this._currentUser.set(await this.gateway.restore());
  }

  async login(credentials: LoginCredentials): Promise<void> {
    this._currentUser.set(await this.gateway.login(credentials));
  }

  async register(data: RegistrationData): Promise<void> {
    this._currentUser.set(await this.gateway.register(data));
  }

  /** Encerra a sessão e apaga o estado em memória das telas. */
  async logout(): Promise<void> {
    await this.gateway.logout();
    this.endSession();
  }

  /** Só o nome pode ser alterado: e-mail e senha são dados de autenticação, com fluxo próprio. */
  async updateName(name: string): Promise<User> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > USER_NAME_MAX_LENGTH) {
      throw new RangeError('Invalid name');
    }
    const updated = await this.gateway.updateName(this.requireUser(), normalized);
    this._currentUser.set(updated);
    return updated;
  }

  /**
   * Apaga o usuário e todos os dados dele, confirmando com a senha atual (errada →
   * `IncorrectPasswordError`), além das preferências deste navegador e da sessão. Não pode ser
   * desfeito.
   */
  async deleteAccount(password: string): Promise<void> {
    await this.gateway.deleteAccount(this.requireUser(), password);
    this.preferences.reset();
    await this.logout();
  }

  /**
   * Esquece o usuário sem falar com o servidor: usado quando a sessão já não vale mais (por
   * exemplo, a API respondeu 401).
   */
  endSession(): void {
    this._currentUser.set(null);
    this.cleanup.run();
  }

  private requireUser(): User {
    const user = this._currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user;
  }
}
