import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { throwError } from 'rxjs';
import { seedAccounts, signInTestUser } from '../../../../testing/account-fixtures';
import { InMemoryAccountRepository } from '../../../../testing/in-memory-account.repository';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { appConfig } from '../../../app.config';

describe('AccountListPage', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    harness = await RouterTestingHarness.create();
  });

  async function open(): Promise<void> {
    await harness.navigateByUrl('/accounts');
    await harness.fixture.whenStable();
    loader = TestbedHarnessEnvironment.loader(harness.fixture);
  }

  function text(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  function cardNames(): string[] {
    const element = harness.routeNativeElement as HTMLElement;
    return [...element.querySelectorAll('.account-card__name')].map(
      (name) => name.textContent?.trim() ?? '',
    );
  }

  async function select(label: string): Promise<MatSelectHarness> {
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    return (await field.getControl(MatSelectHarness))!;
  }

  it('shows the empty state when there are no accounts', async () => {
    await open();

    expect(text()).toContain('Você ainda não cadastrou nenhuma conta.');
  });

  it('lists the active accounts with their balances and the total', async () => {
    seedAccounts(
      userId,
      { name: 'Nubank', institution: 'Nu Pagamentos', initialBalance: 123_456 },
      { name: 'Carteira', type: 'cash', initialBalance: 5_000 },
      { name: 'Antiga', isArchived: true, initialBalance: 99_900 },
    );

    await open();

    expect(cardNames()).toEqual(['Carteira', 'Nubank']);
    expect(text()).toMatch(/R\$\s1\.234,56/);
    expect(text()).toContain('2 contas ativas');
    expect(text()).toMatch(/Saldo total\s+R\$\s1\.284,56/);
  });

  it('searches, filters and sorts the list', async () => {
    seedAccounts(
      userId,
      { name: 'Nubank', institution: 'Nu Pagamentos', initialBalance: 10_000 },
      { name: 'Poupança', type: 'savings', institution: 'Caixa', initialBalance: 50_000 },
      { name: 'Antiga', institution: 'Caixa', isArchived: true },
    );
    await open();

    await (
      await loader.getHarness(MatInputHarness.with({ selector: '[type="search"]' }))
    ).setValue('caixa');
    expect(cardNames()).toEqual(['Poupança']);

    await (await select('Status')).clickOptions({ text: 'Todas' });
    expect(cardNames()).toEqual(['Antiga', 'Poupança']);

    await (await select('Tipo')).clickOptions({ text: 'Poupança' });
    expect(cardNames()).toEqual(['Poupança']);

    await (
      await loader.getHarness(MatInputHarness.with({ selector: '[type="search"]' }))
    ).setValue('inexistente');
    expect(text()).toContain('Nenhuma conta corresponde aos filtros.');

    await (await loader.getHarness(MatButtonHarness.with({ text: 'Limpar filtros' }))).click();
    await (await select('Ordenar por')).clickOptions({ text: 'Maior saldo' });
    expect(cardNames()).toEqual(['Poupança', 'Nubank']);
  });

  it('archives an account after confirmation, keeping its data', async () => {
    seedAccounts(userId, { name: 'Nubank', initialBalance: 10_000 });
    await open();

    const menu = await loader.getHarness(
      MatMenuHarness.with({ selector: '[aria-label="Ações da conta Nubank"]' }),
    );
    await menu.clickItem({ text: /Arquivar/ });
    const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
    expect(await dialog.getText()).toContain('O histórico é preservado');
    await (await dialog.getHarness(MatButtonHarness.with({ text: 'Arquivar' }))).click();

    await vi.waitFor(() =>
      expect(TestBed.inject(InMemoryAccountRepository).records[0]).toMatchObject({
        isArchived: true,
        initialBalance: 10_000,
      }),
    );
    await harness.fixture.whenStable();
    expect(cardNames()).toEqual([]);
  });

  it('shows an error with a retry action when loading fails', async () => {
    const repository = TestBed.inject(InMemoryAccountRepository);
    const listByUser = vi
      .spyOn(repository, 'listByUser')
      .mockReturnValueOnce(throwError(() => new Error('offline')));
    await open();

    expect(text()).toContain('Não foi possível carregar as contas.');

    await (await loader.getHarness(MatButtonHarness.with({ text: 'Tentar novamente' }))).click();
    await harness.fixture.whenStable();

    expect(listByUser).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Você ainda não cadastrou nenhuma conta.');
  });
});
