import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { AuthService } from '../auth/auth.service';
import { ApiProblemError } from './api-problem-error';
import { problemDetailsInterceptor } from './problem-details.interceptor';

describe('problemDetailsInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;
  const endSession = vi.fn();

  beforeEach(() => {
    endSession.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailsInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: AuthService, useValue: { endSession } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    controller.verify();
  });

  function problem(status: number, extra: object = {}): object {
    return { type: 'about:blank', title: 'Erro', status, detail: 'Motivo da recusa.', ...extra };
  }

  it('turns a 422 into an ApiProblemError with the field names without the body prefix', async () => {
    const request = firstValueFrom(http.post('/api/v1/transactions', {}));
    controller.expectOne('/api/v1/transactions').flush(
      problem(422, {
        errors: [{ field: 'body.categoryId', message: 'Categoria não encontrada.' }],
      }),
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const error = await request.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect(error).toMatchObject({ status: 422, message: 'Motivo da recusa.', field: 'categoryId' });
  });

  it('turns a 409 into an ApiProblemError', async () => {
    const request = firstValueFrom(http.delete('/api/v1/transactions/t1'));
    controller
      .expectOne('/api/v1/transactions/t1')
      .flush(problem(409), { status: 409, statusText: 'Conflict' });

    await expect(request).rejects.toMatchObject({ status: 409, field: null });
  });

  it('ends the session and goes to the login, keeping the current page, on a 401', async () => {
    await router.navigateByUrl('/');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const request = firstValueFrom(http.get('/api/v1/accounts'));
    controller
      .expectOne('/api/v1/accounts')
      .flush(problem(401), { status: 401, statusText: 'Unauthorized' });

    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(endSession).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  it('leaves the 401 of the auth routes to the AuthGateway', async () => {
    const request = firstValueFrom(http.post('/api/v1/auth/login', {}));
    controller
      .expectOne('/api/v1/auth/login')
      .flush(problem(401), { status: 401, statusText: 'Unauthorized' });

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(endSession).not.toHaveBeenCalled();
  });

  it('does not touch requests outside the API', async () => {
    const request = firstValueFrom(http.get('/assets/config.json'));
    controller
      .expectOne('/assets/config.json')
      .flush(problem(422), { status: 422, statusText: 'Unprocessable Entity' });

    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
