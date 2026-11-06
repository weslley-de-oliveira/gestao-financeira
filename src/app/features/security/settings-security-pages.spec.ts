import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { InMemoryUserRepository } from '../../../testing/in-memory-user.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { CRYPTO_WAIT } from '../../../testing/wait';
import { appConfig } from '../../app.config';
import { AuthService } from '../../core/auth/auth.service';
import { PreferencesService } from '../../core/preferences/preferences.service';

describe('settings and security pages', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    await signInTestUser();
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    loader = TestbedHarnessEnvironment.loader(harness.fixture);
  }

  function text(): string {
    return (harness.routeNativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  async function input(label: string): Promise<MatInputHarness> {
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    return (await field.getControl(MatInputHarness))!;
  }

  async function click(label: string | RegExp): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: label }))).click();
    await harness.fixture.whenStable();
  }

  describe('settings', () => {
    it('updates the name and keeps the e-mail read-only', async () => {
      await open('/settings');

      expect(text()).toContain('ana@exemplo.com');
      expect(
        await loader.getAllHarnesses(MatFormFieldHarness.with({ floatingLabelText: 'E-mail' })),
      ).toHaveLength(0);

      await (await input('Nome')).setValue('Ana Maria');
      await click('Salvar perfil');

      await vi.waitFor(
        () => expect(TestBed.inject(AuthService).currentUser()?.name).toBe('Ana Maria'),
        CRYPTO_WAIT,
      );
      expect(TestBed.inject(InMemoryUserRepository).records[0].user.name).toBe('Ana Maria');
    });

    it('applies theme and density immediately and tells they are local', async () => {
      await open('/settings');

      const [theme, density] = await loader.getAllHarnesses(MatButtonToggleGroupHarness);
      await (await theme.getToggles({ text: /Escuro/ }))[0].check();
      await (await density.getToggles({ text: 'Compacta' }))[0].check();
      TestBed.tick();

      const preferences = TestBed.inject(PreferencesService);
      expect(preferences.theme()).toBe('dark');
      expect(document.documentElement.classList).toContain('dark-theme');
      expect(document.documentElement.classList).toContain('compact-density');
      expect(text()).toContain('salvos apenas neste navegador');
    });

    it('offers the accent palettes as radio buttons, navy by default', async () => {
      await open('/settings');
      const root = harness.routeNativeElement as HTMLElement;
      const radios = [...root.querySelectorAll<HTMLInputElement>('input[name=accent]')];

      expect(radios.map((radio) => radio.value)).toEqual([
        'navy',
        'azure',
        'cyan',
        'green',
        'violet',
        'rose',
        'orange',
      ]);
      expect(radios.find((radio) => radio.checked)?.value).toBe('navy');

      radios.find((radio) => radio.value === 'green')!.click();
      TestBed.tick();

      expect(TestBed.inject(PreferencesService).accent()).toBe('green');
      expect(document.documentElement.classList).toContain('accent-green');
      expect(
        root.querySelector('.accent-picker[role=radiogroup]')?.getAttribute('aria-labelledby'),
      ).toBe('settings-accent-label');
    });

    it('ends the session', async () => {
      await open('/settings');

      await click(/Encerrar sessão/);

      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'), CRYPTO_WAIT);
      expect(TestBed.inject(AuthService).currentUser()).toBeNull();
    });
  });

  describe('security', () => {
    it('encrypts and decrypts, clearing the passphrase after use', async () => {
      await open('/security');

      await (await input('Frase secreta de demonstração')).setValue('frase de teste');
      await click(/Criptografar/);
      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('IV (base64)');
      }, CRYPTO_WAIT);
      expect(await (await input('Frase secreta de demonstração')).getValue()).toBe('');

      await (await input('Frase secreta')).setValue('frase de teste');
      await click(/Descriptografar/);
      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('Texto original: Saldo fictício da conta de teste');
      }, CRYPTO_WAIT);
      expect(await (await input('Frase secreta')).getValue()).toBe('');
    });

    it('shows a generic error for a wrong passphrase', async () => {
      await open('/security');
      await (await input('Frase secreta de demonstração')).setValue('frase de teste');
      await click(/Criptografar/);
      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('IV (base64)');
      }, CRYPTO_WAIT);

      await (await input('Frase secreta')).setValue('frase errada');
      await click(/Descriptografar/);

      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('a frase está incorreta ou os dados foram alterados');
      }, CRYPTO_WAIT);
    });

    it('validates the passphrase length', async () => {
      await open('/security');
      await (await input('Frase secreta de demonstração')).setValue('curta');

      await click(/Criptografar/);

      const field = await loader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: 'Frase secreta de demonstração' }),
      );
      expect(await field.getTextErrors()).toEqual(['Use pelo menos 8 caracteres.']);
    });

    it('deletes the account only after the e-mail and the current password are typed', async () => {
      await open('/security');
      const button = await loader.getHarness(
        MatButtonHarness.with({ text: /Excluir conta e dados/ }),
      );
      expect(await button.isDisabled()).toBe(true);

      await (await input('Digite seu e-mail para confirmar')).setValue('outra@exemplo.com');
      await (await input('Senha atual (confirmação)')).setValue('senha123');
      expect(await button.isDisabled()).toBe(true);

      await (await input('Digite seu e-mail para confirmar')).setValue('ANA@exemplo.com');
      expect(await button.isDisabled()).toBe(false);
      await button.click();

      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'), CRYPTO_WAIT);
      expect(TestBed.inject(InMemoryUserRepository).records).toEqual([]);
    });

    it('changes the password, checking the current one and the rules of the new one', async () => {
      await open('/security');
      await (await input('Senha atual')).setValue('senha-errada1');
      await (await input('Senha nova')).setValue('senha-errada1');
      await (await input('Confirmar a senha nova')).setValue('outra1234');
      await click('Trocar a senha');
      expect(text()).toContain('A senha nova deve ser diferente da atual.');
      expect(text()).toContain('As senhas não coincidem.');

      await (await input('Senha nova')).setValue('novaSenha99');
      await (await input('Confirmar a senha nova')).setValue('novaSenha99');
      await click('Trocar a senha');
      await vi.waitFor(() => {
        harness.fixture.detectChanges();
        expect(text()).toContain('Senha incorreta.');
      }, CRYPTO_WAIT);

      await (await input('Senha atual')).setValue('senha123');
      await click('Trocar a senha');
      const auth = TestBed.inject(AuthService);
      await vi.waitFor(async () => {
        harness.fixture.detectChanges();
        expect(await (await input('Senha atual')).getValue()).toBe('');
      }, CRYPTO_WAIT);
      await auth.logout();
      await auth.login({ email: 'ana@exemplo.com', password: 'novaSenha99' });
      expect(auth.currentUser()?.email).toBe('ana@exemplo.com');
    });

    it('keeps the account and warns when the current password is wrong', async () => {
      await open('/security');
      await (await input('Digite seu e-mail para confirmar')).setValue('ana@exemplo.com');
      await (await input('Senha atual (confirmação)')).setValue('senha-errada');

      await (
        await loader.getHarness(MatButtonHarness.with({ text: /Excluir conta e dados/ }))
      ).click();

      await vi.waitFor(() => {
        harness.fixture.detectChanges();
        expect(harness.fixture.nativeElement.textContent).toContain('Senha incorreta.');
      }, CRYPTO_WAIT);
      expect(TestBed.inject(InMemoryUserRepository).records).toHaveLength(1);
    });
  });
});
