import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TEST_PROVIDERS } from '../testing/test-providers';
import { appConfig } from './app.config';
import { AuthService } from './core/auth/auth.service';
import { PeriodService } from './core/services/period.service';

describe('app routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    harness = await RouterTestingHarness.create();
  });

  function element(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function url(): string {
    return TestBed.inject(Router).url;
  }

  async function signIn(): Promise<void> {
    await TestBed.inject(AuthService).register({
      name: 'Ana Teste',
      email: 'ana@exemplo.com',
      password: 'senha123',
    });
  }

  describe('without a session', () => {
    it('redirects protected pages to the login, keeping the destination', async () => {
      await harness.navigateByUrl('/accounts');

      expect(url()).toBe('/login?returnUrl=%2Faccounts');
      expect(element().querySelector('app-public-layout')).not.toBeNull();
      expect(element().querySelector('app-shell')).toBeNull();
      expect(TestBed.inject(Title).getTitle()).toBe('Entrar · Gestão Financeira');
    });

    it('renders the register page in the public layout', async () => {
      await harness.navigateByUrl('/register');

      expect(element().querySelector('app-register-page')).not.toBeNull();
      expect(element().querySelector('app-shell')).toBeNull();
    });

    it('renders the not found page for unknown paths', async () => {
      await harness.navigateByUrl('/rota-inexistente');

      expect(element().querySelector('h1')?.textContent).toContain('Página não encontrada');
      expect(TestBed.inject(Title).getTitle()).toBe('Página não encontrada · Gestão Financeira');
    });
  });

  describe('with a session', () => {
    beforeEach(signIn);

    it('redirects the root path to the dashboard inside the authenticated layout', async () => {
      await harness.navigateByUrl('/');

      expect(url()).toBe('/dashboard');
      expect(element().querySelector('app-shell')).not.toBeNull();
      expect(element().querySelector('app-dashboard-page')).not.toBeNull();
      expect(TestBed.inject(Title).getTitle()).toBe('Dashboard · Gestão Financeira');
    });

    it('redirects login and register to the dashboard', async () => {
      for (const path of ['/login', '/register']) {
        await harness.navigateByUrl(path);

        expect(url()).toBe('/dashboard');
      }
    });

    it('marks the current navigation item with aria-current', async () => {
      await harness.navigateByUrl('/accounts');

      const current = element().querySelector('nav a[aria-current="page"]');
      expect(current?.textContent).toContain('Contas');
    });

    it('shows the current page title in the topbar', async () => {
      await harness.navigateByUrl('/transactions');

      expect(element().querySelector('app-topbar')?.textContent).toContain('Transações');
    });

    it('updates the selected period from the topbar selector', async () => {
      await harness.navigateByUrl('/dashboard');
      const loader = TestbedHarnessEnvironment.loader(harness.fixture);

      const select = await loader.getHarness(
        MatSelectHarness.with({ selector: '.topbar__period mat-select' }),
      );
      await select.clickOptions({ text: 'Últimos 3 meses' });

      expect(TestBed.inject(PeriodService).selected()).toBe('last-3-months');
    });
  });
});
