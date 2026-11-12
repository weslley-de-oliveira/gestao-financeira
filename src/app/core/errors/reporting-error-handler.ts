import { ErrorHandler, Injectable, inject } from '@angular/core';
import { requestIdOf } from '../interceptors/request-id.interceptor';
import { ErrorReportingService } from './error-reporting.service';

/**
 * Faz o mesmo que o `ErrorHandler` do Angular (o erro aparece no console) e relata o erro à API.
 * Recebe também os erros globais do navegador (`provideBrowserGlobalErrorListeners`). Erros de
 * requisições à API ficam de fora: a API já registra os dela, e o interceptor relata os que não
 * chegaram a ela.
 */
@Injectable()
export class ReportingErrorHandler extends ErrorHandler {
  private readonly reporting = inject(ErrorReportingService);

  override handleError(error: unknown): void {
    super.handleError(error);
    if (!requestIdOf(error)) {
      this.reporting.reportError(error);
    }
  }
}
