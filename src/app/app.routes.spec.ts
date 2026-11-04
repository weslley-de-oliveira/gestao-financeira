import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from './app.config';
import { PeriodService } from './core/services/period.service';

describe('app routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    harness = await RouterTestingHarness.create();
  });

  function element(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  it('redirects the root path to the dashboard inside the authenticated layout', async () => {
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/dashboard');
    expect(element().querySelector('app-shell')).not.toBeNull();
    expect(element().querySelector('h1')?.textContent).toContain('Dashboard');
    expect(TestBed.inject(Title).getTitle()).toBe('Dashboard · Gestão Financeira');
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

  it('renders login and register in the public layout, without the sidebar', async () => {
    for (const url of ['/login', '/register']) {
      await harness.navigateByUrl(url);

      expect(element().querySelector('app-public-layout')).not.toBeNull();
      expect(element().querySelector('app-shell')).toBeNull();
    }
  });

  it('renders the not found page for unknown paths', async () => {
    await harness.navigateByUrl('/rota-inexistente');

    expect(element().querySelector('h1')?.textContent).toContain('Página não encontrada');
    expect(TestBed.inject(Title).getTitle()).toBe('Página não encontrada · Gestão Financeira');
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
