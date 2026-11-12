import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, Injectable, inject } from '@angular/core';
import {
  ClientErrorReport,
  ErrorReportRepository,
} from '../../data-access/repositories/error-report.repository';

/** Relatos por carregamento da página: um erro em laço não vira uma enxurrada de pedidos. */
export const MAX_REPORTS_PER_PAGE = 5;

/** Limites do contrato da API (`POST /v1/client-errors`). */
const MAX_MESSAGE = 500;
const MAX_NAME = 100;
const MAX_STACK = 4_000;

/**
 * Relata à API os erros que nenhuma tela trata: erros de JavaScript (pelo `ErrorHandler`) e
 * requisições sem resposta da API (pelo interceptor). Cada mensagem vai uma vez só, e no máximo
 * `MAX_REPORTS_PER_PAGE` por carregamento. Uma falha do próprio relato é ignorada.
 */
@Injectable({ providedIn: 'root' })
export class ErrorReportingService {
  private readonly repository = inject(ErrorReportRepository);
  private readonly document = inject(DOCUMENT);
  private readonly reported = new Set<string>();

  /** Erro de JavaScript não tratado. */
  reportError(error: unknown): void {
    const details =
      error instanceof Error
        ? { name: error.name, message: error.message || error.name, stack: error.stack }
        : { message: String(error) };
    this.send({ kind: 'error', ...details });
  }

  /** Requisição à API sem resposta dela: rede, proxy ou API fora do ar. */
  reportNetworkFailure(error: HttpErrorResponse, requestId: string): void {
    // Só o caminho: o navegador informa o endereço completo, e a query string pode ter buscas.
    const url = new URL(error.url ?? '', this.document.location.origin).pathname;
    const message =
      error.status === 0
        ? `Sem resposta da API: ${url}`
        : `Resposta ${error.status} sem Problem Details: ${url}`;
    this.send({ kind: 'network', message, requestId });
  }

  private send(report: Omit<ClientErrorReport, 'path'>): void {
    const key = `${report.kind}:${report.message}`;
    if (this.reported.has(key) || this.reported.size >= MAX_REPORTS_PER_PAGE) {
      return;
    }
    this.reported.add(key);

    const truncated: ClientErrorReport = {
      kind: report.kind,
      message: report.message.slice(0, MAX_MESSAGE),
      path: this.document.location.pathname,
      ...(report.name && { name: report.name.slice(0, MAX_NAME) }),
      ...(report.stack && { stack: report.stack.slice(0, MAX_STACK) }),
      ...(report.requestId && { requestId: report.requestId }),
    };
    this.repository.report(truncated).subscribe({ error: () => undefined });
  }
}
