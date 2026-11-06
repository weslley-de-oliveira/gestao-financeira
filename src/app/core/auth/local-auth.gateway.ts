import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserDataRepository } from '../../data-access/repositories/user-data.repository';
import { UserRepository } from '../../data-access/repositories/user.repository';
import { User } from '../../shared/models/user';
import { EncryptedSessionStorage } from '../security/encrypted-session-storage';
import { PasswordHasher } from '../security/password-hasher';
import {
  EmailAlreadyRegisteredError,
  IncorrectPasswordError,
  InvalidCredentialsError,
} from './auth.errors';
import { AuthGateway, LoginCredentials, RegistrationData } from './auth.gateway';

const SESSION_KEY = 'gf.session';

/**
 * Autenticação demonstrativa, para a demo (`localStorage`) e o JSON Server: não oferece segurança
 * de produção. A senha é conferida no navegador contra um hash PBKDF2, e a sessão guarda apenas os
 * dados públicos do usuário, criptografados no sessionStorage.
 */
@Injectable()
export class LocalAuthGateway extends AuthGateway {
  private readonly users = inject(UserRepository);
  private readonly hasher = inject(PasswordHasher);
  private readonly session = inject(EncryptedSessionStorage);
  private readonly userData = inject(UserDataRepository);

  restore(): Promise<User | null> {
    return this.session.getItem<User>(SESSION_KEY);
  }

  async login({ email, password }: LoginCredentials): Promise<User> {
    const record = await firstValueFrom(this.users.findByEmail(normalizeEmail(email)));
    if (!record || !(await this.hasher.verify(password, record.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    return this.startSession(record.user);
  }

  async register({ name, email, password }: RegistrationData): Promise<User> {
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
    return this.startSession(user);
  }

  /** Apaga a sessão criptografada (e a chave dela). */
  logout(): Promise<void> {
    return this.session.removeItem(SESSION_KEY);
  }

  async updateName(user: User, name: string): Promise<User> {
    const updated = await firstValueFrom(this.users.updateName(user.id, name));
    return this.startSession(updated);
  }

  async deleteAccount(user: User, password: string): Promise<void> {
    const record = await firstValueFrom(this.users.findByEmail(user.email));
    if (!record || !(await this.hasher.verify(password, record.passwordHash))) {
      throw new IncorrectPasswordError();
    }
    await firstValueFrom(this.userData.deleteAllForUser(user.id));
  }

  private async startSession(user: User): Promise<User> {
    await this.session.setItem(SESSION_KEY, user);
    return user;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
