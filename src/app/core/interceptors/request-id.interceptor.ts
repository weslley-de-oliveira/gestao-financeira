import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CLIENT_ERRORS_PATH } from '../../data-access/api/api-error-report.repository';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { ErrorReportingService } from '../errors/error-reporting.service';
import { isProblemDetails } from './api-problem-error';

/** Cabeçalho que a API usa como id da requisição nos logs e devolve na resposta. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Id da requisição que produziu cada erro (os erros não mudam de tipo para levá-lo). */
const requestIds = new WeakMap<object, string>();

/**
 * Dá um id (UUID) a cada requisição à API e o envia em `X-Request-Id`; a API o usa nos logs. O id
 * é conhecido mesmo quando a resposta não chega (rede, proxy), e fica associado ao erro que a
 * requisição produzir: `requestIdOf(erro)` o recupera para mostrar o código na tela.
 *
 * Falhas que não vieram da API (sem resposta, ou 5xx sem Problem Details, como as do proxy) não
 * aparecem nos logs dela: são relatadas por `POST /v1/client-errors`, com o id.
 *
 * Fica antes dos demais interceptores, para associar o id ao erro já convertido por eles.
 */
export const requestIdInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const reporting = inject(ErrorReportingService);
  if (!request.url.startsWith(baseUrl)) {
    return next(request);
  }

  const id = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  return next(request.clone({ setHeaders: { [REQUEST_ID_HEADER]: id } })).pipe(
    catchError((error: unknown) => {
      if (typeof error === 'object' && error !== null) {
        requestIds.set(error, id);
      }
      if (
        error instanceof HttpErrorResponse &&
        cameFromOutsideTheApi(error) &&
        request.url !== `${baseUrl}${CLIENT_ERRORS_PATH}`
      ) {
        reporting.reportNetworkFailure(error, id);
      }
      return throwError(() => error);
    }),
  );
};

/** Id da requisição à API que produziu o erro, se ele veio de uma. */
export function requestIdOf(error: unknown): string | null {
  return typeof error === 'object' && error !== null ? (requestIds.get(error) ?? null) : null;
}

/** Sem resposta, ou um 5xx que a API não escreveu (ela sempre responde com Problem Details). */
function cameFromOutsideTheApi(error: HttpErrorResponse): boolean {
  return (
    error.status === 0 ||
    (error.status >= HttpStatusCode.InternalServerError && !isProblemDetails(error.error))
  );
}
