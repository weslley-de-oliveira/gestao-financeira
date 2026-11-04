import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { Title } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts, signInTestUser } from '../../../../testing/account-fixtures';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { appConfig } from '../../../app.config';

describe('AccountDetailPage', () => {
  let harness: RouterTestingHarness;
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
  }

  function text(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the account with its current and initial balances', async () => {
    const [account] = seedAccounts(userId, {
      name: 'Nubank',
      institution: 'Nu Pagamentos',
      initialBalance: -2_500,
    });

    await open(`/accounts/${account.id}`);

    expect(text()).toContain('Nubank');
    expect(text()).toMatch(/Conta corrente\s+·\s+Nu Pagamentos/);
    expect(text()).toMatch(/Saldo atual\s+-R\$\s25,00/);
    expect(text()).toContain('Nenhuma transação vinculada a esta conta.');
    expect(TestBed.inject(Title).getTitle()).toBe('Detalhe da conta · Gestão Financeira');
  });

  it('reactivates an archived account after confirmation', async () => {
    const [account] = seedAccounts(userId, { name: 'Antiga', isArchived: true });
    await open(`/accounts/${account.id}`);
    expect(text()).toContain('Arquivada');

    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    await (await loader.getHarness(MatButtonHarness.with({ text: /Reativar/ }))).click();
    const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
    await (await dialog.getHarness(MatButtonHarness.with({ text: 'Reativar' }))).click();

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text()).not.toContain('Arquivada');
    });
  });

  it('shows a not found message for unknown accounts', async () => {
    await open('/accounts/inexistente');

    expect(text()).toContain('Conta não encontrada.');
  });
});
