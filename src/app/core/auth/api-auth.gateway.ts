import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import type { ApiUser } from '../../data-access/api/api-types';
import { User } from '../../shared/models/user';
import { ApiProblemError, isProblemDetails } from '../interceptors/api-problem-error';
import {
  EmailAlreadyRegisteredError,
  IncorrectPasswordError,
  InvalidCredentialsError,
} from './auth.errors';
import { AuthGateway, LoginCredentials, RegistrationData } from './auth.gateway';

/**
 * Autenticação pela API: a sessão fica num cookie `HttpOnly` definido pelo servidor, que o
 * navegador envia sozinho (mesma origem, pelo proxy). O front não guarda token nem senha; ao
 * abrir o app, pergunta à API quem é o usuário da sessão.
 */
@Injectable()
export class ApiAuthGateway extends AuthGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  async restore(): Promise<User | null> {
    try {
      return toUser(await firstValueFrom(this.http.get<ApiUser>(`${this.baseUrl}/auth/me`)));
    } catch (error) {
      // Sem sessão (ou expirada): o app abre na tela de login.
      if (hasStatus(error, HttpStatusCode.Unauthorized)) {
        return null;
      }
      throw error;
    }
  }

  async login(credentials: LoginCredentials): Promise<User> {
    try {
      return toUser(
        await firstValueFrom(this.http.post<ApiUser>(`${this.baseUrl}/auth/login`, credentials)),
      );
    } catch (error) {
      throw hasStatus(error, HttpStatusCode.Unauthorized) ? new InvalidCredentialsError() : error;
    }
  }

  async register(data: RegistrationData): Promise<User> {
    try {
      return toUser(
        await firstValueFrom(this.http.post<ApiUser>(`${this.baseUrl}/auth/register`, data)),
      );
    } catch (error) {
      throw hasStatus(error, HttpStatusCode.Conflict) ? new EmailAlreadyRegisteredError() : error;
    }
  }

  async logout(): Promise<void> {
    // Sem corpo: a API recusa um POST com `Content-Type: application/json` e corpo vazio.
    await firstValueFrom(this.http.post(`${this.baseUrl}/auth/logout`, null));
  }

  async updateName(_user: User, name: string): Promise<User> {
    return toUser(await firstValueFrom(this.http.patch<ApiUser>(`${this.baseUrl}/me`, { name })));
  }

  async deleteAccount(_user: User, password: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/me`, { body: { password } }));
    } catch (error) {
      // A API responde 422 no campo `password` quando a senha atual está errada.
      throw hasStatus(error, HttpStatusCode.UnprocessableEntity)
        ? new IncorrectPasswordError()
        : error;
    }
  }

  async changePassword(_user: User, currentPassword: string, newPassword: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/me/password`, { currentPassword, newPassword }),
      );
    } catch (error) {
      // 422 no campo `currentPassword`: a senha atual está errada. Os demais 422 (regras da senha
      // nova) já são conferidos pelo formulário e seguem como estão.
      throw rejectedField(error) === 'currentPassword' ? new IncorrectPasswordError() : error;
    }
  }
}

function toUser({ id, name, email, createdAt }: ApiUser): User {
  return { id, name, email, createdAt };
}

/** Status da recusa, venha como `HttpErrorResponse` ou já convertida pelo interceptor. */
/** Primeiro campo recusado num 422, venha convertido pelo interceptor ou ainda como HTTP. */
function rejectedField(error: unknown): string | null {
  if (error instanceof ApiProblemError) {
    return error.field;
  }
  if (error instanceof HttpErrorResponse && isProblemDetails(error.error)) {
    return new ApiProblemError(error.error).field;
  }
  return null;
}

function hasStatus(error: unknown, status: HttpStatusCode): boolean {
  return (
    (error instanceof HttpErrorResponse || error instanceof ApiProblemError) &&
    error.status === status
  );
}
