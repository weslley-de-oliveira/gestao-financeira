import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { AuthService } from '../auth/auth.service';
import { ApiProblemError, isProblemDetails } from './api-problem-error';
import { StaleRecordError } from './stale-record-error';

/** Recusas que viram `ApiProblemError`; as demais seguem como `HttpErrorResponse`. */
const PROBLEM_STATUSES: ReadonlySet<number> = new Set([
  HttpStatusCode.Conflict,
  HttpStatusCode.UnprocessableEntity,
]);

/**
 * Trata as respostas de erro da API:
 * - 401 fora de `/auth`: a sessão expirou ou foi encerrada em outro lugar; encerra a sessão local
 *   e leva ao login, voltando depois para a página atual (`returnUrl`). Em `/auth`, o 401 é a
 *   resposta esperada (credenciais inválidas, ninguém logado) e fica com o `AuthGateway`;
 * - 409 e 422 com Problem Details: viram `ApiProblemError`, com o motivo e os campos recusados;
 * - 412 (`If-Match` de uma versão antiga): vira `StaleRecordError`.
 */
export const problemDetailsInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!request.url.startsWith(baseUrl)) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      if (
        error.status === HttpStatusCode.Unauthorized &&
        !request.url.startsWith(`${baseUrl}/auth/`)
      ) {
        auth.endSession();
        if (!router.url.startsWith('/login')) {
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }
      if (error.status === HttpStatusCode.PreconditionFailed) {
        return throwError(() => new StaleRecordError());
      }
      if (PROBLEM_STATUSES.has(error.status) && isProblemDetails(error.error)) {
        return throwError(() => new ApiProblemError(error.error));
      }
      return throwError(() => error);
    }),
  );
};
