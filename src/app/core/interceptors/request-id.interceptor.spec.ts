import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import {
  ClientErrorReport,
  ErrorReportRepository,
} from '../../data-access/repositories/error-report.repository';
import { AuthService } from '../auth/auth.service';
import { ApiProblemError } from './api-problem-error';
import { problemDetailsInterceptor } from './problem-details.interceptor';
import { REQUEST_ID_HEADER, requestIdInterceptor, requestIdOf } from './request-id.interceptor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestIdInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const reports: ClientErrorReport[] = [];

  beforeEach(() => {
    reports.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([requestIdInterceptor, problemDetailsInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: AuthService, useValue: { endSession: vi.fn() } },
        {
          provide: ErrorReportRepository,
          useValue: {
            report: (report: ClientErrorReport) => {
              reports.push(report);
              return of(undefined);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
  });

  it('sends a new UUID in each request to the API', async () => {
    const first = firstValueFrom(http.get('/api/v1/accounts'));
    const second = firstValueFrom(http.get('/api/v1/accounts'));
    const [a, b] = controller.match('/api/v1/accounts');
    a?.flush([]);
    b?.flush([]);
    await Promise.all([first, second]);

    const ids = [a, b].map((request) => request?.request.headers.get(REQUEST_ID_HEADER));
    expect(ids[0]).toMatch(UUID);
    expect(ids[1]).toMatch(UUID);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('does not touch requests outside the API', async () => {
    const request = firstValueFrom(http.get('/assets/config.json'));
    const pending = controller.expectOne('/assets/config.json');
    pending.flush({});
    await request;

    expect(pending.request.headers.has(REQUEST_ID_HEADER)).toBe(false);
  });

  it('associates the request id with the error, after the other interceptors convert it', async () => {
    const request = firstValueFrom(http.post('/api/v1/transactions', {}));
    const pending = controller.expectOne('/api/v1/transactions');
    pending.flush(
      { type: 'about:blank', title: 'Conflito', status: 409, detail: 'Recusado.' },
      { status: 409, statusText: 'Conflict' },
    );

    const error = await request.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect(requestIdOf(error)).toBe(pending.request.headers.get(REQUEST_ID_HEADER));
  });

  it('associates the id with network failures too', async () => {
    const request = firstValueFrom(http.get('/api/v1/accounts'));
    const pending = controller.expectOne('/api/v1/accounts');
    pending.error(new ProgressEvent('error'), { status: 0, statusText: '' });

    const error = await request.catch((reason: unknown) => reason);
    expect(requestIdOf(error)).toBe(pending.request.headers.get(REQUEST_ID_HEADER));
  });

  it('reports network failures, with the request id', async () => {
    const request = firstValueFrom(http.get('/api/v1/accounts?q=mercado'));
    const pending = controller.expectOne('/api/v1/accounts?q=mercado');
    pending.error(new ProgressEvent('error'), { status: 0, statusText: '' });
    await request.catch(() => undefined);

    expect(reports).toEqual([
      expect.objectContaining({
        kind: 'network',
        message: 'Sem resposta da API: /api/v1/accounts',
        requestId: pending.request.headers.get(REQUEST_ID_HEADER),
      }),
    ]);
  });

  it('reports 5xx responses that did not come from the API, but not the API own errors', async () => {
    const proxy = firstValueFrom(http.get('/api/v1/accounts'));
    controller
      .expectOne('/api/v1/accounts')
      .flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    await proxy.catch(() => undefined);

    const api = firstValueFrom(http.get('/api/v1/goals'));
    controller
      .expectOne('/api/v1/goals')
      .flush(
        { type: 'about:blank', title: 'Erro interno', status: 500, detail: 'Erro.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await api.catch(() => undefined);

    expect(reports).toEqual([
      expect.objectContaining({ message: 'Resposta 502 sem Problem Details: /api/v1/accounts' }),
    ]);
  });

  it('does not report failures of the error report itself', async () => {
    const request = firstValueFrom(http.post('/api/v1/client-errors', {}));
    controller
      .expectOne('/api/v1/client-errors')
      .error(new ProgressEvent('error'), { status: 0, statusText: '' });
    await request.catch(() => undefined);

    expect(reports).toEqual([]);
  });

  it('has no id for errors that did not come from a request', () => {
    expect(requestIdOf(new Error('falha local'))).toBeNull();
    expect(requestIdOf('texto')).toBeNull();
  });
});
