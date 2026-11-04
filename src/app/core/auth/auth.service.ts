import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserDataRepository } from '../../data-access/repositories/user-data.repository';
import { UserRepository } from '../../data-access/repositories/user.repository';
import { USER_NAME_MAX_LENGTH, User } from '../../shared/models/user';
import { PreferencesService } from '../preferences/preferences.service';
import { EncryptedSessionStorage } from '../security/encrypted-session-storage';
import { PasswordHasher } from '../security/password-hasher';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from './auth.errors';
import { SessionCleanup } from './session-cleanup';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
}

const SESSION_KEY = 'gf.session';

/**
 * Autenticação demonstrativa sobre o JSON Server: não oferece segurança de produção.
 * A sessão guarda apenas os dados públicos do usuário, criptografados no sessionStorage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly users = inject(UserRepository);
  private readonly hasher = inject(PasswordHasher);
  private readonly session = inject(EncryptedSessionStorage);
  private readonly userData = inject(UserDataRepository);
  private readonly preferences = inject(PreferencesService);
  private readonly cleanup = inject(SessionCleanup);
  private readonly _currentUser = signal<User | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  async restoreSession(): Promise<void> {
    this._currentUser.set(await this.session.getItem<User>(SESSION_KEY));
  }

  async login({ email, password }: LoginCredentials): Promise<void> {
    const record = await firstValueFrom(this.users.findByEmail(normalizeEmail(email)));
    if (!record || !(await this.hasher.verify(password, record.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    await this.startSession(record.user);
  }

  async register({ name, email, password }: RegistrationData): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    if (await firstValueFrom(this.users.findByEmail(normalizedEmail))) {
      throw new EmailAlreadyRegisteredError();
    }
    const { user } = await firstValueFrom(
      this.users.create({
        user: {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
        },
        passwordHash: await this.hasher.hash(password),
      }),
    );
    await this.startSession(user);
  }

  /** Encerra a sessão: apaga a sessão criptografada e o estado em memória das telas. */
  async logout(): Promise<void> {
    await this.session.removeItem(SESSION_KEY);
    this._currentUser.set(null);
    this.cleanup.run();
  }

  /** Só o nome pode ser alterado: e-mail e senha são dados de autenticação, com fluxo próprio. */
  async updateName(name: string): Promise<User> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > USER_NAME_MAX_LENGTH) {
      throw new RangeError('Invalid name');
    }
    const updated = await firstValueFrom(this.users.updateName(this.requireUser().id, normalized));
    await this.startSession(updated);
    return updated;
  }

  /**
   * Apaga o usuário e todos os dados fictícios dele na API, as preferências deste navegador e a
   * sessão. Não pode ser desfeito.
   */
  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.userData.deleteAllForUser(this.requireUser().id));
    this.preferences.reset();
    await this.logout();
  }

  private requireUser(): User {
    const user = this._currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user;
  }

  private async startSession(user: User): Promise<void> {
    await this.session.setItem(SESSION_KEY, user);
    this._currentUser.set(user);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
