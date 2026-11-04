import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../../testing/account-fixtures';
import { signInTestUser } from '../../../../testing/auth-fixtures';
import { InMemoryAccountRepository } from '../../../../testing/in-memory-account.repository';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { appConfig } from '../../../app.config';

describe('AccountFormPage', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    harness = await RouterTestingHarness.create();
  });

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    loader = TestbedHarnessEnvironment.loader(harness.fixture);
  }

  function field(label: string | RegExp): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function input(label: string | RegExp): Promise<MatInputHarness> {
    return (await (await field(label)).getControl(MatInputHarness))!;
  }

  async function select(label: string): Promise<MatSelectHarness> {
    return (await (await field(label)).getControl(MatSelectHarness))!;
  }

  async function save(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Salvar' }))).click();
    await harness.fixture.whenStable();
  }

  function records() {
    return TestBed.inject(InMemoryAccountRepository).records;
  }

  it('validates the required name and balance', async () => {
    await open('/accounts/new');
    await (await input('Saldo inicial')).setValue('');

    await save();

    expect(await (await field('Nome da conta')).getTextErrors()).toEqual([
      'Informe o nome da conta.',
    ]);
    expect(await (await field('Saldo inicial')).getTextErrors()).toEqual([
      'Informe o saldo inicial.',
    ]);
    expect(records()).toHaveLength(0);
  });

  it('masks the balance as the digits are typed, from right to left', async () => {
    await open('/accounts/new');
    // Digitação real, tecla a tecla: `MatInputHarness.setValue` sobrescreve o valor final sem evento.
    const balance = await (await input('Saldo inicial')).host();
    await balance.clear();

    await balance.sendKeys('5');
    expect(await balance.getProperty('value')).toBe('0,05');

    await balance.sendKeys('0', '0');
    expect(await balance.getProperty('value')).toBe('5,00');

    await balance.sendKeys('-');
    expect(await balance.getProperty('value')).toBe('-5,00');

    await save();
    expect(await (await field('Saldo inicial')).getTextErrors()).toEqual([]);
  });

  it('creates an account with the selected options and the balance in cents', async () => {
    await open('/accounts/new');
    await (await input('Nome da conta')).setValue('Reserva');
    await (await select('Tipo')).clickOptions({ text: 'Poupança' });
    await (await input(/^Instituição/)).setValue('Banco Fictício');
    await (await input('Saldo inicial')).setValue('123456');
    await (await select('Cor')).clickOptions({ text: 'Verde' });
    await (await select('Ícone')).clickOptions({ text: 'Cofrinho' });

    await save();

    expect(records()).toEqual([
      expect.objectContaining({
        userId,
        name: 'Reserva',
        type: 'savings',
        institution: 'Banco Fictício',
        initialBalance: 123_456,
        color: '#2e7d32',
        icon: 'savings',
        isArchived: false,
      }),
    ]);
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe(`/accounts/${records()[0].id}`));
  });

  it('does not show the archive toggle when creating', async () => {
    await open('/accounts/new');

    expect(await loader.getAllHarnesses(MatSlideToggleHarness)).toHaveLength(0);
  });

  it('loads the account for editing and saves the changes', async () => {
    const [account] = seedAccounts(userId, {
      name: 'Carteira',
      type: 'cash',
      initialBalance: -1_590,
    });
    await open(`/accounts/${account.id}/edit`);

    expect(await (await input('Nome da conta')).getValue()).toBe('Carteira');
    expect(await (await input('Saldo inicial')).getValue()).toBe('-15,90');
    expect(await (await select('Tipo')).getValueText()).toBe('Dinheiro');

    await (await input('Saldo inicial')).setValue('2000');
    await (await loader.getHarness(MatSlideToggleHarness)).check();
    await save();

    expect(records()[0]).toMatchObject({ initialBalance: 2_000, isArchived: true });
  });

  it('does not open accounts of other users', async () => {
    const [account] = seedAccounts('someone-else', { name: 'Outra pessoa' });

    await open(`/accounts/${account.id}/edit`);

    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      'Conta não encontrada.',
    );
  });
});
