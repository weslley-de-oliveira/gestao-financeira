import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  ClientErrorReport,
  ErrorReportRepository,
} from '../../data-access/repositories/error-report.repository';
import { ErrorReportingService, MAX_REPORTS_PER_PAGE } from './error-reporting.service';

describe('ErrorReportingService', () => {
  const report =
    vi.fn<(report: ClientErrorReport) => ReturnType<ErrorReportRepository['report']>>();
  let service: ErrorReportingService;

  beforeEach(() => {
    report.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorReportRepository, useValue: { report } }],
    });
    service = TestBed.inject(ErrorReportingService);
  });

  it('reports a JavaScript error with its name, message, stack and the current path', () => {
    const error = new TypeError('x is undefined');

    service.reportError(error);

    expect(report).toHaveBeenCalledWith({
      kind: 'error',
      name: 'TypeError',
      message: 'x is undefined',
      stack: error.stack,
      path: location.pathname,
    });
  });

  it('reports values that are not errors as text', () => {
    service.reportError('falhou');

    expect(report).toHaveBeenCalledWith({
      kind: 'error',
      message: 'falhou',
      path: location.pathname,
    });
  });

  it('reports a network failure without the query string', () => {
    const error = new HttpErrorResponse({
      status: 0,
      url: `${location.origin}/api/v1/transactions?busca=farmacia`,
    });

    service.reportNetworkFailure(error, 'id-da-requisicao');

    expect(report).toHaveBeenCalledWith({
      kind: 'network',
      message: 'Sem resposta da API: /api/v1/transactions',
      requestId: 'id-da-requisicao',
      path: location.pathname,
    });
  });

  it('truncates long fields to the API limits', () => {
    const error = new Error('m'.repeat(600));
    error.name = 'N'.repeat(150);
    error.stack = 's'.repeat(5_000);

    service.reportError(error);

    const sent = report.mock.calls[0]?.[0];
    expect(sent?.message).toHaveLength(500);
    expect(sent?.name).toHaveLength(100);
    expect(sent?.stack).toHaveLength(4_000);
  });

  it('reports each message once', () => {
    service.reportError(new Error('repetido'));
    service.reportError(new Error('repetido'));

    expect(report).toHaveBeenCalledTimes(1);
  });

  it(`stops after ${MAX_REPORTS_PER_PAGE} reports per page load`, () => {
    for (let index = 0; index < MAX_REPORTS_PER_PAGE + 3; index++) {
      service.reportError(new Error(`erro ${index}`));
    }

    expect(report).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE);
  });

  it('ignores failures of the report itself', () => {
    report.mockReturnValue(throwError(() => new Error('API fora do ar')));

    expect(() => service.reportError(new Error('original'))).not.toThrow();
  });
});
