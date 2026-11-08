import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { throwError } from 'rxjs';
import { seedAccounts } from '../../../../testing/account-fixtures';
import { signInTestUser } from '../../../../testing/auth-fixtures';
import { FakeChartRenderer } from '../../../../testing/fake-chart-renderer';
import { seedGoals } from '../../../../testing/goal-fixtures';
import { InMemoryAccountRepository } from '../../../../testing/in-memory-account.repository';
import { InMemoryTransactionRepository } from '../../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { seedTransactions } from '../../../../testing/transaction-fixtures';
import { appConfig } from '../../../app.config';
import { DashboardRepository } from '../../../data-access/repositories/dashboard.repository';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { PeriodService } from '../../../core/services/period.service';

describe('DashboardPage', () => {
  let harness: RouterTestingHarness;
  let userId: string;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    harness = await RouterTestingHarness.create();
  });

  async function open(): Promise<void> {
    await harness.navigateByUrl('/dashboard');
    await harness.fixture.whenStable();
  }

  function element(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function text(): string {
    return (element().textContent ?? '').replace(/\s+/g, ' ');
  }

  function charts() {
    return TestBed.inject(FakeChartRenderer).charts;
  }

  /** Hoje nos testes: 15/11/2026. */
  function seedMonth(): void {
    seedAccounts(
      userId,
      { name: 'Corrente', initialBalance: 100_000 },
      { name: 'Poupança', initialBalance: 50_000 },
      { name: 'Antiga', initialBalance: 30_000, isArchived: true },
    );
    seedTransactions(
      userId,
      { description: 'Mercado', amount: 25_090, date: '2026-11-03' },
      { description: 'Salário', type: 'income', amount: 500_000, date: '2026-11-05' },
      {
        description: 'Reserva',
        type: 'transfer',
        categoryId: null,
        destinationAccountId: 'account-2',
        amount: 100_000,
        date: '2026-11-06',
      },
      { description: 'Aluguel', amount: 150_000, date: '2026-11-20', status: 'pending' },
      { description: 'Outubro', amount: 40_000, date: '2026-10-20' },
    );
  }

  it('greets the user and links to the new transaction flow', async () => {
    await open();

    expect(element().querySelector('h1')?.textContent).toContain('Olá, Ana!');
    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    await (await loader.getHarness(MatButtonHarness.with({ text: /Nova transação/ }))).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/transactions/new');
  });

  it('guides the first steps when there are no accounts or transactions', async () => {
    await open();

    expect(text()).toContain('Seu resumo financeiro aparece aqui');
    expect(element().querySelector('a[href="/accounts/new"]')).not.toBeNull();
    expect(charts()).toEqual([]);
  });

  it('summarizes the period without counting transfers or pending transactions', async () => {
    seedMonth();

    await open();

    // 1.500,00 iniciais (sem a arquivada) − 250,90 − 400,00 + 5.000,00; a transferência não muda.
    expect(text()).toMatch(/Saldo total R\$ 5\.849,10 Saldo atual de 2 contas ativas/);
    expect(text()).toMatch(/Receitas \+R\$ 5\.000,00/);
    expect(text()).toMatch(/Despesas −R\$ 250,90/);
    expect(text()).toMatch(/Resultado\s*R\$ 4\.749,10 1 pendente fora do cálculo/);
  });

  it('takes the money saved in goals out of the balance, without counting it as expense', async () => {
    seedMonth();
    const contribution = { note: null, createdAt: '2026-11-10T10:00:00.000Z' };
    seedGoals(userId, {
      contributions: [
        {
          ...contribution,
          id: 'c1',
          type: 'deposit',
          amount: 80_000,
          accountId: 'account-1',
          date: '2026-11-10',
        },
        {
          ...contribution,
          id: 'c2',
          type: 'withdrawal',
          amount: 30_000,
          accountId: 'account-2',
          date: '2026-11-12',
        },
      ],
    });

    await open();

    // 5.849,10 − 800,00 + 300,00
    expect(text()).toMatch(/Saldo total R\$ 5\.349,10/);
    expect(text()).toMatch(/Despesas −R\$ 250,90/);
    const balance = charts()[1].series[0].values;
    expect(balance[8]).toBe(584_910);
    expect(balance[9]).toBe(504_910);
    expect(balance.at(-1)).toBe(534_910);
  });

  it('feeds the charts from the same transactions as the cards', async () => {
    seedMonth();

    await open();

    const [incomeExpense, balance] = charts();
    expect(incomeExpense.type).toBe('bar');
    expect(incomeExpense.labels).toEqual(['01–07', '08–14', '15–21', '22–28', '29–30']);
    expect(incomeExpense.series.map((series) => [series.label, series.values])).toEqual([
      ['Receitas', [500_000, 0, 0, 0, 0]],
      ['Despesas', [25_090, 0, 0, 0, 0]],
    ]);
    expect(balance.type).toBe('line');
    expect(balance.labels).toHaveLength(30);
    expect(balance.labels[0]).toBe('01/11');
    expect(balance.series[0].values.at(-1)).toBe(584_910);
    // Tabela equivalente para leitores de tela.
    expect(element().querySelector('table caption')?.textContent).toContain(
      'Receitas e despesas realizadas no período',
    );
  });

  it('updates the indicators and charts when the period changes', async () => {
    seedMonth();
    await open();

    TestBed.inject(PeriodService).select('last-3-months');
    await harness.fixture.whenStable();

    expect(text()).toMatch(/Despesas −R\$ 650,90/);
    expect(charts()[0].labels).toEqual(['set/26', 'out/26', 'nov/26']);
  });

  it('lists the most recent transactions of the period', async () => {
    seedMonth();

    await open();

    const descriptions = [...element().querySelectorAll('.recent__link')].map((link) =>
      link.textContent?.trim(),
    );
    expect(descriptions).toEqual(['Aluguel', 'Reserva', 'Salário', 'Mercado']);
    expect(text()).toContain('Corrente → Poupança');
  });

  it('shows an empty chart state when the period has no income or expense', async () => {
    seedAccounts(userId, { name: 'Corrente' });

    await open();

    expect(text()).toContain('Nenhuma receita ou despesa realizada no período.');
    expect(text()).toContain('Nenhuma transação no período.');
    expect(charts().map((chart) => chart.type)).toEqual(['line']);
  });

  it('keeps the summary when only the account names fail to load', async () => {
    seedMonth();
    // Contas e cartões só dão os nomes das transações recentes.
    vi.spyOn(TestBed.inject(AccountsFacade), 'load').mockResolvedValue();

    await open();

    expect(text()).toMatch(/Saldo total R\$ 5\.849,10/);
    expect(text()).toMatch(/Receitas \+R\$ 5\.000,00/);
    expect(text()).toContain('Salário');
  });

  it('loads the whole summary in one request and retries it after a failure', async () => {
    seedMonth();
    const repository = TestBed.inject(DashboardRepository);
    const load = vi.spyOn(repository, 'load');
    load.mockReturnValueOnce(throwError(() => new Error('offline')));

    await open();
    expect(text()).toContain('Não foi possível carregar o dashboard.');

    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Tentar novamente' }))).click();
    await harness.fixture.whenStable();

    expect(text()).toMatch(/Saldo total R\$ 5\.849,10/);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows a general error when nothing loads', async () => {
    for (const repository of [
      TestBed.inject(InMemoryAccountRepository),
      TestBed.inject(InMemoryTransactionRepository),
    ]) {
      vi.spyOn(repository, 'listByUser').mockReturnValue(throwError(() => new Error('offline')));
    }

    await open();

    expect(text()).toContain('Não foi possível carregar o dashboard.');
  });
});
