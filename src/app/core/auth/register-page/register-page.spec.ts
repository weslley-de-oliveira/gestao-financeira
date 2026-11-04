import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { InMemoryUserRepository } from '../../../../testing/in-memory-user.repository';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { CRYPTO_WAIT } from '../../../../testing/wait';
import { appConfig } from '../../../app.config';
import { AuthService } from '../auth.service';

describe('RegisterPage', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    harness = await RouterTestingHarness.create('/register');
    loader = TestbedHarnessEnvironment.loader(harness.fixture);
  });

  function field(label: string): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function fill(values: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(values)) {
      const control = await (await field(label)).getControl();
      await (control as { setValue(value: string): Promise<void> }).setValue(value);
    }
  }

  async function submit(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Criar conta' }))).click();
    await harness.fixture.whenStable();
  }

  const valid = {
    Nome: 'Ana Teste',
    'E-mail': 'ana@exemplo.com',
    Senha: 'senha123',
    'Confirmar senha': 'senha123',
  };

  it('validates the password policy and confirmation', async () => {
    await fill({ ...valid, Senha: 'senhaforte', 'Confirmar senha': 'outra' });

    await submit();

    expect(await (await field('Senha')).getTextErrors()).toEqual([
      'A senha deve conter pelo menos uma letra e um número.',
    ]);
    expect(await (await field('Confirmar senha')).getTextErrors()).toEqual([
      'As senhas não coincidem.',
    ]);
    expect(TestBed.inject(InMemoryUserRepository).records).toHaveLength(0);
  });

  it('shows an error on the e-mail field when it is already registered', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.register({ name: 'Outra', email: 'ana@exemplo.com', password: 'senha123' });
    await auth.logout();

    await fill(valid);
    await submit();

    expect(await (await field('E-mail')).getTextErrors()).toEqual([
      'Este e-mail já está cadastrado.',
    ]);
    expect(TestBed.inject(Router).url).toBe('/register');
  });

  it('creates the account, starts the session and goes to the dashboard', async () => {
    await fill(valid);

    await submit();

    // O hash da senha roda na Web Crypto, fora do controle do Angular: aguarda o resultado.
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/dashboard'), CRYPTO_WAIT);
    expect(TestBed.inject(AuthService).currentUser()?.name).toBe('Ana Teste');
  });
});
