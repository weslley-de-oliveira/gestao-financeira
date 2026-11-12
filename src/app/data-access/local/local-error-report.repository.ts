import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ClientErrorReport, ErrorReportRepository } from '../repositories/error-report.repository';

/** Na demo não há servidor: o relato fica só no console do navegador. */
@Injectable()
export class LocalErrorReportRepository extends ErrorReportRepository {
  report(report: ClientErrorReport): Observable<void> {
    console.warn('Erro relatado (demo, sem servidor):', report);
    return of(undefined);
  }
}
