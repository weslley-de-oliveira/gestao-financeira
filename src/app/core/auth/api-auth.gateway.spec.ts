import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../data-access/api/api.config';
import { User } from '../../shared/models/user';
import { ApiAuthGateway } from './api-auth.gateway';
import {
  EmailAlreadyRegisteredError,
  IncorrectPasswordError,
  InvalidCredentialsError,
} from './auth.errors';

describe('ApiAuthGateway', () => {
  let gateway: ApiAuthGateway;
  let http: HttpTestingController;

  const user: User = {
    id: '0190f1a2-0000-7000-8000-000000000001',
    name: 'Ana Teste',
    email: 'ana@exemplo.com',
    createdAt: '2026-11-15T12:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        ApiAuthGateway,
      ],
    });
    gateway = TestBed.inject(ApiAuthGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Answers with a Problem Details body, like the API. */
  function fail(url: string, method: string, status: number): void {
    http
      .expectOne({ url, method })
      .flush({ status, title: 'Erro', detail: 'Erro' }, { status, statusText: 'Erro' });
  }

  it('restores the session from the cookie with GET /auth/me', async () => {
    const restored = gateway.restore();
    http.expectOne({ url: '/api/v1/auth/me', method: 'GET' }).flush(user);

    expect(await restored).toEqual(user);
  });

  it('restores as signed out when there is no session (401)', async () => {
    const restored = gateway.restore();
    fail('/api/v1/auth/me', 'GET', 401);

    expect(await restored).toBeNull();
  });

  it('logs in with POST /auth/login and maps 401 to invalid credentials', async () => {
    const credentials = { email: 'ana@exemplo.com', password: 'senha123' };

    const ok = gateway.login(credentials);
    const request = http.expectOne({ url: '/api/v1/auth/login', method: 'POST' });
    expect(request.request.body).toEqual(credentials);
    request.flush(user);
    expect(await ok).toEqual(user);

    const wrong = gateway.login(credentials);
    fail('/api/v1/auth/login', 'POST', 401);
    await expect(wrong).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('registers with POST /auth/register and maps 409 to e-mail already registered', async () => {
    const data = { name: 'Ana Teste', email: 'ana@exemplo.com', password: 'senha123' };

    const taken = gateway.register(data);
    fail('/api/v1/auth/register', 'POST', 409);

    await expect(taken).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('logs out with a bodiless POST /auth/logout', async () => {
    const done = gateway.logout();
    const request = http.expectOne({ url: '/api/v1/auth/logout', method: 'POST' });
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(done).resolves.toBeUndefined();
  });

  it('updates the name with PATCH /me', async () => {
    const updated = gateway.updateName(user, 'Ana Maria');
    const request = http.expectOne({ url: '/api/v1/me', method: 'PATCH' });
    expect(request.request.body).toEqual({ name: 'Ana Maria' });
    request.flush({ ...user, name: 'Ana Maria' });

    expect((await updated).name).toBe('Ana Maria');
  });

  it('deletes the account with DELETE /me and the password, mapping 422 to incorrect password', async () => {
    const deleted = gateway.deleteAccount(user, 'senha123');
    const request = http.expectOne({ url: '/api/v1/me', method: 'DELETE' });
    expect(request.request.body).toEqual({ password: 'senha123' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(deleted).resolves.toBeUndefined();

    const wrong = gateway.deleteAccount(user, 'errada');
    fail('/api/v1/me', 'DELETE', 422);
    await expect(wrong).rejects.toBeInstanceOf(IncorrectPasswordError);
  });

  it('passes other errors (e.g. 429 rate limit) on to the screen', async () => {
    const limited = gateway.login({ email: 'ana@exemplo.com', password: 'x' });
    fail('/api/v1/auth/login', 'POST', 429);

    await expect(limited).rejects.toMatchObject({ status: 429 });
  });
});
