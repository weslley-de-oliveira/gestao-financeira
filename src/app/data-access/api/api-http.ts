import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MonoTypeOperatorFunction, Observable, catchError, of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiProblemError } from '../../core/interceptors/api-problem-error';

/**
 * Dono dos registros na integração com a API. O servidor deriva o usuário da sessão (cookie) e não
 * devolve `userId`; os modelos do app continuam com o campo, preenchido com o usuário da sessão.
 */
@Injectable({ providedIn: 'root' })
export class SessionUser {
  private readonly auth = inject(AuthService);

  id(): string {
    return this.auth.currentUser()?.id ?? '';
  }
}

/** 404 vira `null` (registro inexistente ou de outro usuário); os outros erros seguem. */
export function nullWhenNotFound<T>(): (source: Observable<T>) => Observable<T | null> {
  return (source) =>
    source.pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
}

/**
 * Converte as recusas conhecidas da API (`ApiProblemError`, do interceptor) no erro de domínio
 * que a tela já trata, igual ao das regras locais. As demais seguem como estão.
 */
export function toDomainError<T>(
  convert: (problem: ApiProblemError) => Error | null,
): MonoTypeOperatorFunction<T> {
  return (source) =>
    source.pipe(
      catchError((error: unknown) =>
        throwError(() => (error instanceof ApiProblemError && convert(error)) || error),
      ),
    );
}

/** Copia só as chaves permitidas que vieram definidas (a API recusa campos desconhecidos). */
export function pick<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (value[key] !== undefined) {
      result[key] = value[key];
    }
  }
  return result;
}
