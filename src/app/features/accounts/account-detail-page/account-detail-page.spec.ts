import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { Title } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../../testing/account-fixtures';
import { signInTestUser } from '../../../../testing/auth-fixtures';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { seedTransactions } from '../../../../testing/transaction-fixtures';
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

  it('shows the balance with completed transactions and the recent linked ones', async () => {
    const [checking] = seedAccounts(
      userId,
      { name: 'Corrente', initialBalance: 100_000 },
      { name: 'Poupança' },
    );
    seedTransactions(
      userId,
      { description: 'Mercado', amount: 25_000, date: '2026-11-02' },
      {
        description: 'Reserva',
        type: 'transfer',
        categoryId: null,
        destinationAccountId: 'account-2',
        amount: 10_000,
        date: '2026-11-03',
      },
      { description: 'Aluguel', amount: 150_000, date: '2026-11-04', status: 'pending' },
      { description: 'Outra conta', accountId: 'account-2', date: '2026-11-05' },
    );

    await open(`/accounts/${checking.id}`);

    expect(text()).toMatch(/Saldo atual\s+R\$\s650,00/);
    const descriptions = [
      ...(harness.routeNativeElement as HTMLElement).querySelectorAll(
        '.account-detail__transaction-description',
      ),
    ].map((link) => link.textContent?.trim());
    expect(descriptions).toEqual(['Aluguel', 'Reserva', 'Mercado']);
    expect(text()).toMatch(/−R\$\s100,00/);
    expect(text()).toContain('3 no total');
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
