import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { CRYPTO_WAIT } from '../../../testing/wait';
import { appConfig } from '../../app.config';
import { DEMO_CREDENTIALS } from '../../data-access/local/demo-credentials';
import { DemoData } from '../../data-access/repositories/demo-data';
import { AuthService } from '../auth/auth.service';

class FakeDemoData extends DemoData {
  restored = 0;

  async restoreInitialData(): Promise<void> {
    this.restored++;
  }
}

/**
 * Conta de demonstração (nas duas builds) e restauração dos dados iniciais (só na build de demo,
 * com os dados no navegador).
 */
describe('demo actions', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let demoData: FakeDemoData;

  async function setup(providers: Provider[]): Promise<void> {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, ...TEST_PROVIDERS, ...providers],
    });
    harness = await RouterTestingHarness.create();
  }

  const demoProviders = (): Provider[] => {
    demoData = new FakeDemoData();
    return [{ provide: DemoData, useValue: demoData }];
  };

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    loader = TestbedHarnessEnvironment.loader(harness.fixture);
  }

  function text(): string {
    return (harness.routeNativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  async function click(label: string | RegExp): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: label }))).click();
    await harness.fixture.whenStable();
  }

  async function confirm(): Promise<void> {
    const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
    await (await dialog.getHarness(MatButtonHarness.with({ text: 'Restaurar' }))).click();
    await harness.fixture.whenStable();
  }

  it('shows the shared demo account but hides the data restore outside the demo build', async () => {
    await setup([]);
    await open('/login');

    expect(text()).toContain(`${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`);
    expect(text()).toContain('compartilhada');
    expect(await loader.getAllHarnesses(MatButtonHarness.with({ text: /Restaurar/ }))).toEqual([]);

    await signInTestUser();
    await open('/settings');
    expect(text()).not.toContain('Dados da demonstração');
  });

  it('shows the demo credentials and signs in with them', async () => {
    await setup(demoProviders());
    const auth = TestBed.inject(AuthService);
    await auth.register({ name: 'Demo', ...DEMO_CREDENTIALS });
    await auth.logout();
    await open('/login');

    expect(text()).toContain(`${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`);
    await click('Entrar com a conta de demonstração');

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/dashboard'), CRYPTO_WAIT);
    expect(auth.currentUser()?.email).toBe(DEMO_CREDENTIALS.email);
  });

  it('restores the initial data from the login page after confirmation', async () => {
    await setup(demoProviders());
    await open('/login');

    await click(/Restaurar dados iniciais/);
    await confirm();

    await vi.waitFor(() => expect(demoData.restored).toBe(1));
  });

  it('restores the initial data from the settings and ends the session', async () => {
    await setup(demoProviders());
    await signInTestUser();
    await open('/settings');

    expect(text()).toContain('Dados da demonstração');
    await click(/Restaurar dados iniciais/);
    await confirm();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
    expect(demoData.restored).toBe(1);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });
});
