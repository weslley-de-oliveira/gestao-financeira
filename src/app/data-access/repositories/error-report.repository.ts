import { Observable } from 'rxjs';

/** Erro inesperado do front, relatado para aparecer nos logs da API. */
export interface ClientErrorReport {
  /** `error`: erro de JavaScript não tratado; `network`: a requisição não teve resposta da API. */
  kind: 'error' | 'network';
  message: string;
  name?: string;
  stack?: string;
  /** Página em que o erro ocorreu, sem a query string. */
  path: string;
  /** Id da requisição que falhou, se houver. */
  requestId?: string;
}

/**
 * Contrato do relato de erros: na API, `POST /v1/client-errors` (grava nos logs dela); na demo,
 * sem servidor, só o console do navegador.
 */
export abstract class ErrorReportRepository {
  abstract report(report: ClientErrorReport): Observable<void>;
}
