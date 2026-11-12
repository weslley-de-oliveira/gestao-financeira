import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';

/** Cabeçalho que a API usa como id da requisição nos logs e devolve na resposta. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Id da requisição que produziu cada erro (os erros não mudam de tipo para levá-lo). */
const requestIds = new WeakMap<object, string>();

/**
 * Dá um id (UUID) a cada requisição à API e o envia em `X-Request-Id`; a API o usa nos logs. O id
 * é conhecido mesmo quando a resposta não chega (rede, proxy), e fica associado ao erro que a
 * requisição produzir: `requestIdOf(erro)` o recupera para mostrar o código na tela.
 *
 * Fica antes dos demais interceptores, para associar o id ao erro já convertido por eles.
 */
export const requestIdInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!request.url.startsWith(baseUrl)) {
    return next(request);
  }

  const id = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  return next(request.clone({ setHeaders: { [REQUEST_ID_HEADER]: id } })).pipe(
    catchError((error: unknown) => {
      if (typeof error === 'object' && error !== null) {
        requestIds.set(error, id);
      }
      return throwError(() => error);
    }),
  );
};

/** Id da requisição à API que produziu o erro, se ele veio de uma. */
export function requestIdOf(error: unknown): string | null {
  return typeof error === 'object' && error !== null ? (requestIds.get(error) ?? null) : null;
}
