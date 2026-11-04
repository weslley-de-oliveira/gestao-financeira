import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MatDatepickerInputHarness } from '@angular/material/datepicker/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedGoals } from '../../../testing/goal-fixtures';
import { InMemoryGoalRepository } from '../../../testing/in-memory-goal.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { appConfig } from '../../app.config';

describe('goal pages', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  // Hoje: 15/11/2026.
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

  function text(): string {
    return (harness.routeNativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  function field(label: string | RegExp): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function input(label: string | RegExp): Promise<MatInputHarness> {
    return (await (await field(label)).getControl(MatInputHarness))!;
  }

  async function typeMoney(label: string, digits: string): Promise<void> {
    const host = await (await input(label)).host();
    await host.clear();
    await host.sendKeys(digits);
  }

  async function click(text: string | RegExp): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text }))).click();
    await harness.fixture.whenStable();
  }

  async function confirm(label: string): Promise<void> {
    const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
    await (await dialog.getHarness(MatButtonHarness.with({ text: label }))).click();
  }

  function records() {
    return TestBed.inject(InMemoryGoalRepository).records;
  }

  describe('list', () => {
    it('shows the empty state', async () => {
      await open('/goals');

      expect(text()).toContain('Criar a primeira meta');
    });

    it('shows progress, status and pace, and filters by status', async () => {
      seedGoals(
        userId,
        { name: 'Viagem', initialAmount: 250_000, deadline: '2027-04-30' },
        { name: 'Carro', initialAmount: 1_200_000 },
        { name: 'Curso', deadline: '2026-10-01' },
        { name: 'Antiga', isArchived: true },
      );

      await open('/goals');

      const content = text();
      expect(content).toContain('3 metas ativas');
      expect(content).not.toContain('Antiga');
      expect(content).toMatch(/R\$\s2\.500,00 de R\$\s10\.000,00 \(25%\)/);
      expect(content).toMatch(/Faltam R\$\s7\.500,00/);
      expect(content).toMatch(/R\$\s1\.250,00\/mês/);
      expect(content).toMatch(/Excedeu R\$\s2\.000,00/);
      expect(content).toContain('Concluída');
      expect(content).toContain('Atrasada');
      // Atrasada primeiro.
      expect(content.indexOf('Curso')).toBeLessThan(content.indexOf('Viagem'));

      const status = (await (await field('Status')).getControl(MatSelectHarness))!;
      await status.clickOptions({ text: 'Arquivadas' });
      expect(text()).toContain('Antiga');
      expect(text()).not.toContain('Viagem');
    });
  });

  describe('form', () => {
    it('validates and creates a goal with an optional deadline', async () => {
      await open('/goals/new');

      await click('Salvar');
      expect(await (await field('Nome da meta')).getTextErrors()).toEqual([
        'Informe o nome da meta.',
      ]);
      expect(await (await field('Valor-alvo')).getTextErrors()).toEqual(['Informe o valor-alvo.']);

      await (await input('Nome da meta')).setValue('Viagem ao Japão');
      await typeMoney('Valor-alvo', '1500000');
      await typeMoney('Valor inicial acumulado', '300000');
      await (await loader.getHarness(MatDatepickerInputHarness)).setValue('31/12/2027');
      await click('Salvar');

      expect(records()).toEqual([
        expect.objectContaining({
          name: 'Viagem ao Japão',
          targetAmount: 1_500_000,
          initialAmount: 300_000,
          deadline: '2027-12-31',
          contributions: [],
        }),
      ]);
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe(`/goals/${records()[0].id}`));
    });

    it('rejects a deadline in the past', async () => {
      await open('/goals/new');
      await (await input('Nome da meta')).setValue('Atrasada');
      await typeMoney('Valor-alvo', '100000');
      await (await loader.getHarness(MatDatepickerInputHarness)).setValue('01/11/2026');

      await click('Salvar');

      expect(await (await field(/Data-limite/)).getTextErrors()).toEqual([
        'A data-limite deve ser hoje ou uma data futura.',
      ]);
      expect(records()).toHaveLength(0);
    });
  });

  describe('detail', () => {
    it('shows the pace and registers a deposit that completes the goal', async () => {
      const [goal] = seedGoals(userId, {
        name: 'Notebook',
        targetAmount: 600_000,
        initialAmount: 300_000,
        deadline: '2027-01-31',
      });
      await open(`/goals/${goal.id}`);

      expect(text()).toMatch(/guarde R\$\s1\.000,00 por mês durante 3 meses/);

      await typeMoney('Valor', '350000');
      await (await input('Observação (opcional)')).setValue('13º salário');
      await click('Registrar');

      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('Meta atingida');
      });
      expect(text()).toMatch(/Excedente\s*R\$\s500,00/);
      expect(text()).toContain('13º salário');
      expect(records()[0].contributions).toEqual([
        expect.objectContaining({ type: 'deposit', amount: 350_000, date: '2026-11-15' }),
      ]);
    });

    it('refuses a withdrawal larger than the accumulated amount', async () => {
      const [goal] = seedGoals(userId, { initialAmount: 10_000 });
      await open(`/goals/${goal.id}`);

      const type = await loader.getHarness(MatButtonToggleGroupHarness);
      await (await type.getToggles({ text: 'Retirada' }))[0].check();
      await typeMoney('Valor', '20000');
      await click('Registrar');

      expect(await (await field('Valor')).getTextErrors()).toEqual([
        'A retirada é maior que o valor acumulado.',
      ]);
      expect(records()[0].contributions).toHaveLength(0);
    });

    it('pauses and archives the goal', async () => {
      const [goal] = seedGoals(userId, { name: 'Reserva' });
      await open(`/goals/${goal.id}`);

      await click(/Pausar/);
      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('Pausada');
      });

      await click(/Arquivar/);
      await confirm('Arquivar');
      await vi.waitFor(() => expect(records()[0].isArchived).toBe(true));
      expect(records()[0].isPaused).toBe(true);
    });
  });

  it('shows the goals that need attention on the dashboard', async () => {
    // Sem contas nem transações, o Dashboard mostra os primeiros passos em vez dos widgets.
    seedAccounts(userId, { name: 'Corrente' });
    seedGoals(
      userId,
      { name: 'Curso', deadline: '2026-10-01' },
      { name: 'Carro', initialAmount: 1_200_000 },
    );

    await open('/dashboard');

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text()).toContain('Curso');
      expect(text()).toContain('Atrasada');
    });
    // Metas concluídas não aparecem no widget.
    expect(text()).not.toContain('Carro');
  });
});
