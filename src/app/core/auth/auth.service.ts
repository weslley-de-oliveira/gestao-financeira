import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserRepository } from '../../data-access/repositories/user.repository';
import { User } from '../../shared/models/user';
import { EncryptedSessionStorage } from '../security/encrypted-session-storage';
import { PasswordHasher } from '../security/password-hasher';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from './auth.errors';

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

  async logout(): Promise<void> {
    await this.session.removeItem(SESSION_KEY);
    this._currentUser.set(null);
  }

  private async startSession(user: User): Promise<void> {
    await this.session.setItem(SESSION_KEY, user);
    this._currentUser.set(user);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
