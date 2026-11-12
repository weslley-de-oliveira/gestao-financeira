import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { AuthService } from '../auth/auth.service';
import { ApiProblemError } from './api-problem-error';
import { problemDetailsInterceptor } from './problem-details.interceptor';
import { REQUEST_ID_HEADER, requestIdInterceptor, requestIdOf } from './request-id.interceptor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestIdInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([requestIdInterceptor, problemDetailsInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: AuthService, useValue: { endSession: vi.fn() } },
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

  it('has no id for errors that did not come from a request', () => {
    expect(requestIdOf(new Error('falha local'))).toBeNull();
    expect(requestIdOf('texto')).toBeNull();
  });
});
