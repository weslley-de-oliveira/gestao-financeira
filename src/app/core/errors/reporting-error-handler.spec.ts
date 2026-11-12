import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { requestIdInterceptor } from '../interceptors/request-id.interceptor';
import { ErrorReportingService } from './error-reporting.service';
import { ReportingErrorHandler } from './reporting-error-handler';

describe('ReportingErrorHandler', () => {
  const reportError = vi.fn();
  const reportNetworkFailure = vi.fn();
  let handler: ErrorHandler;

  beforeEach(() => {
    reportError.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([requestIdInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: ErrorReportingService, useValue: { reportError, reportNetworkFailure } },
        { provide: ErrorHandler, useClass: ReportingErrorHandler },
      ],
    });
    handler = TestBed.inject(ErrorHandler);
  });

  it('logs the error to the console, like the default handler, and reports it', () => {
    const error = new Error('quebrou');

    handler.handleError(error);

    expect(console.error).toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('does not report errors of API requests (the API or the interceptor already did)', async () => {
    const request = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/accounts'));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/accounts')
      .flush('Erro', { status: 500, statusText: 'Internal Server Error' });
    const error = await request.catch((reason: unknown) => reason);

    handler.handleError(error);

    expect(reportError).not.toHaveBeenCalled();
  });
});
