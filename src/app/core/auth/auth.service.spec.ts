import { TestBed } from '@angular/core/testing';
import { InMemoryUserRepository } from '../../../testing/in-memory-user.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from './auth.errors';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let repository: InMemoryUserRepository;
  const registration = { name: '  Ana Teste ', email: ' Ana@Exemplo.com ', password: 'senha123' };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    auth = TestBed.inject(AuthService);
    repository = TestBed.inject(InMemoryUserRepository);
  });

  it('registers a user with normalized data and without the plain-text password', async () => {
    await auth.register(registration);

    const [record] = repository.records;
    expect(record.user).toMatchObject({ name: 'Ana Teste', email: 'ana@exemplo.com' });
    expect(JSON.stringify(record)).not.toContain('senha123');
    expect(auth.currentUser()).toEqual(record.user);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('rejects an e-mail that is already registered', async () => {
    await auth.register(registration);

    await expect(
      auth.register({ ...registration, email: 'ana@exemplo.com' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(repository.records).toHaveLength(1);
  });

  it('logs in with valid credentials, ignoring e-mail case', async () => {
    await auth.register(registration);
    await auth.logout();

    await auth.login({ email: 'ANA@exemplo.com', password: 'senha123' });

    expect(auth.currentUser()?.email).toBe('ana@exemplo.com');
  });

  it('uses the same error for a wrong password and an unknown e-mail', async () => {
    await auth.register(registration);
    await auth.logout();

    await expect(
      auth.login({ email: 'ana@exemplo.com', password: 'errada123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      auth.login({ email: 'outra@exemplo.com', password: 'senha123' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('restores the session and clears it on logout', async () => {
    await auth.register(registration);
    const user = auth.currentUser();

    const restored = TestBed.runInInjectionContext(() => new AuthService());
    await restored.restoreSession();
    expect(restored.currentUser()).toEqual(user);

    await auth.logout();
    expect(auth.currentUser()).toBeNull();
    await restored.restoreSession();
    expect(restored.currentUser()).toBeNull();
  });
});
