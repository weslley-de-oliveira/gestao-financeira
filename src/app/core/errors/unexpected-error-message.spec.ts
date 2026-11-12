import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { ErrorReportRepository } from '../../data-access/repositories/error-report.repository';
import { REQUEST_ID_HEADER, requestIdInterceptor } from '../interceptors/request-id.interceptor';
import { unexpectedErrorMessage } from './unexpected-error-message';

describe('unexpectedErrorMessage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([requestIdInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: ErrorReportRepository, useValue: { report: () => of(undefined) } },
      ],
    });
  });

  it('appends the first 8 characters of the request id of an API error', async () => {
    const request = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/accounts'));
    const pending = TestBed.inject(HttpTestingController).expectOne('/api/v1/accounts');
    pending.flush(
      { type: 'about:blank', title: 'Erro interno', status: 500, detail: 'Erro.' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    const error = await request.catch((reason: unknown) => reason);
    const code = pending.request.headers.get(REQUEST_ID_HEADER)?.slice(0, 8);

    expect(unexpectedErrorMessage('Não foi possível salvar.', error)).toBe(
      `Não foi possível salvar. Código do erro: ${code}.`,
    );
  });

  it('keeps the message as is for errors without a request', () => {
    expect(unexpectedErrorMessage('Não foi possível salvar.', new Error('local'))).toBe(
      'Não foi possível salvar.',
    );
  });
});
