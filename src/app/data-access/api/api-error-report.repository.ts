import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ClientErrorReport, ErrorReportRepository } from '../repositories/error-report.repository';
import { API_BASE_URL } from './api.config';
import type { ApiClientError } from './api-types';

/** URL do relato de erros; as falhas dela mesma não são relatadas de novo. */
export const CLIENT_ERRORS_PATH = '/client-errors';

/** Relato gravado nos logs da API (`POST /v1/client-errors`, 204). */
@Injectable()
export class ApiErrorReportRepository extends ErrorReportRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}${CLIENT_ERRORS_PATH}`;

  report(report: ClientErrorReport): Observable<void> {
    const body: ApiClientError = report;
    return this.http.post(this.url, body).pipe(map(() => undefined));
  }
}
