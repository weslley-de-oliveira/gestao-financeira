import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { CRYPTO_WAIT } from '../../../../testing/wait';
import { appConfig } from '../../../app.config';
import { AuthService } from '../auth.service';

describe('LoginPage', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    const auth = TestBed.inject(AuthService);
    await auth.register({ name: 'Ana Teste', email: 'ana@exemplo.com', password: 'senha123' });
    await auth.logout();
    harness = await RouterTestingHarness.create();
  });

  async function open(url = '/login'): Promise<void> {
    await harness.navigateByUrl(url);
    loader = TestbedHarnessEnvironment.loader(harness.fixture);
  }

  async function fill(email: string, password: string): Promise<void> {
    await (
      await loader.getHarness(MatInputHarness.with({ selector: '[type=email]' }))
    ).setValue(email);
    await (
      await loader.getHarness(MatInputHarness.with({ selector: '[autocomplete=current-password]' }))
    ).setValue(password);
  }

  async function submit(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Entrar' }))).click();
    await harness.fixture.whenStable();
  }

  function alertText(): string | undefined {
    return harness.fixture.nativeElement.querySelector('[role=alert]')?.textContent?.trim();
  }

  it('shows the field errors when submitting an empty form', async () => {
    await open();

    await submit();

    const fields = await loader.getAllHarnesses(MatFormFieldHarness);
    expect(await fields[0].getTextErrors()).toEqual(['Informe o e-mail.']);
    expect(await fields[1].getTextErrors()).toEqual(['Informe a senha.']);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  // O hash da senha roda na Web Crypto, fora do controle do Angular: aguarda o resultado.
  it('shows a generic message for invalid credentials', async () => {
    await open();
    await fill('ana@exemplo.com', 'errada123');

    await submit();

    await vi.waitFor(() => {
      harness.fixture.detectChanges();
      expect(alertText()).toBe('E-mail ou senha inválidos.');
    }, CRYPTO_WAIT);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('signs in and goes to the dashboard', async () => {
    await open();
    await fill('ana@exemplo.com', 'senha123');

    await submit();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/dashboard'), CRYPTO_WAIT);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
  });

  it('returns to the requested page after signing in', async () => {
    await open('/goals');
    await fill('ana@exemplo.com', 'senha123');

    await submit();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/goals'), CRYPTO_WAIT);
  });
});
