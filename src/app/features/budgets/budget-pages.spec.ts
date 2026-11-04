import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedBudgets } from '../../../testing/budget-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { InMemoryBudgetRepository } from '../../../testing/in-memory-budget.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { appConfig } from '../../app.config';

describe('budget pages', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  // Hoje: 15/11/2026.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    seedAccounts(userId, { name: 'Corrente' });
    seedCategories(
      userId,
      { name: 'Mercado', icon: 'shopping_cart' },
      { name: 'Lazer' },
      { name: 'Salário', type: 'income' },
    );
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

  function field(label: string): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function select(label: string): Promise<MatSelectHarness> {
    return (await (await field(label)).getControl(MatSelectHarness))!;
  }

  async function save(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Salvar' }))).click();
    await harness.fixture.whenStable();
  }

  function records() {
    return TestBed.inject(InMemoryBudgetRepository).records;
  }

  describe('list', () => {
    it('shows the empty state', async () => {
      await open('/budgets');

      expect(text()).toContain('Criar o primeiro orçamento');
    });

    it('shows the consumption of the month with states in text', async () => {
      seedBudgets(
        userId,
        { categoryId: 'category-1', limits: [{ month: '2026-01', amount: 50_000 }] },
        { categoryId: 'category-2', limits: [{ month: '2026-01', amount: 10_000 }] },
      );
      seedTransactions(
        userId,
        { categoryId: 'category-1', amount: 20_000, date: '2026-11-03' },
        { categoryId: 'category-1', amount: 7_000, date: '2026-11-04', status: 'pending' },
        { categoryId: 'category-2', amount: 12_000, date: '2026-11-05' },
        { categoryId: 'category-2', amount: 1_000, date: '2026-10-05' },
      );

      await open('/budgets');

      const content = text();
      expect(content).toContain('novembro de 2026');
      expect(content).toMatch(/Orçado\s*R\$\s600,00/);
      expect(content).toMatch(/Gasto\s*R\$\s320,00/);
      expect(content).toMatch(/Disponível\s*R\$\s280,00/);
      expect(content).toContain('1 orçamento precisa de atenção');
      expect(content).toContain('Limite excedido');
      expect(content).toMatch(/Excedeu R\$\s20,00/);
      expect(content).toContain('Dentro do limite');
      expect(content).toMatch(/\+ R\$\s70,00 pendentes/);
      // O mais consumido aparece primeiro.
      expect(content.indexOf('Lazer')).toBeLessThan(content.indexOf('Mercado'));
    });

    it('navigates between months', async () => {
      seedBudgets(userId, {
        categoryId: 'category-1',
        limits: [{ month: '2026-11', amount: 50_000 }],
      });
      await open('/budgets');

      await (
        await loader.getHarness(MatButtonHarness.with({ selector: '[aria-label="Mês anterior"]' }))
      ).click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/budgets?month=2026-10');
      expect(text()).toContain('outubro de 2026');
      expect(text()).toContain('Nenhum orçamento valia em outubro de 2026');

      await (await loader.getHarness(MatButtonHarness.with({ text: 'Mês atual' }))).click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/budgets');
    });

    it('deletes a budget after confirmation', async () => {
      seedBudgets(userId, { categoryId: 'category-1' });
      await open('/budgets');

      const menu = await loader.getHarness(
        MatMenuHarness.with({ selector: '[aria-label="Ações do orçamento Mercado"]' }),
      );
      await menu.clickItem({ text: /Excluir/ });
      const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
        MatDialogHarness,
      );
      await (await dialog.getHarness(MatButtonHarness.with({ text: 'Excluir' }))).click();

      await vi.waitFor(() => expect(records()).toHaveLength(0));
    });
  });

  describe('form', () => {
    it('offers only active expense categories without a budget', async () => {
      seedBudgets(userId, { categoryId: 'category-2' });
      await open('/budgets/new');

      const categories = await select('Categoria de despesa');
      await categories.open();
      const names = await Promise.all((await categories.getOptions()).map((o) => o.getText()));
      expect(names.map((name) => name.replace(/^\S+\s/, ''))).toEqual(['Mercado']);
    });

    it('validates and creates a budget with the limit in cents', async () => {
      await open('/budgets/new');

      await save();
      expect(await (await field('Categoria de despesa')).getTextErrors()).toEqual([
        'Selecione a categoria.',
      ]);
      expect(await (await field('Limite mensal')).getTextErrors()).toEqual([
        'Informe o limite mensal.',
      ]);

      await (await select('Categoria de despesa')).clickOptions({ text: /Mercado/ });
      const limit = await (await field('Limite mensal')).getControl(MatInputHarness);
      await (await limit!.host()).sendKeys('80000');
      await (await select('Alertar a partir de')).clickOptions({ text: '90% do limite' });
      await save();

      expect(records()).toEqual([
        expect.objectContaining({
          categoryId: 'category-1',
          limits: [{ month: '2026-11', amount: 80_000 }],
          alertThreshold: 90,
        }),
      ]);
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/budgets'));
    });

    it('edits the limit from the current month on, keeping the category', async () => {
      const [budget] = seedBudgets(userId, {
        categoryId: 'category-1',
        limits: [{ month: '2026-09', amount: 50_000 }],
      });
      await open(`/budgets/${budget.id}/edit`);

      expect(text()).toContain('Categoria Mercado');
      expect(text()).toContain('Vale de novembro de 2026 em diante');
      const limit = (await (await field('Limite mensal')).getControl(MatInputHarness))!;
      expect(await limit.getValue()).toBe('500,00');
      const host = await limit.host();
      await host.clear();
      await host.sendKeys('60000');
      await save();

      expect(records()[0].limits).toEqual([
        { month: '2026-09', amount: 50_000 },
        { month: '2026-11', amount: 60_000 },
      ]);
    });
  });

  it('highlights the most consumed budgets of the month on the dashboard', async () => {
    seedBudgets(userId, {
      categoryId: 'category-1',
      limits: [{ month: '2026-01', amount: 10_000 }],
    });
    seedTransactions(userId, { categoryId: 'category-1', amount: 9_000, date: '2026-11-02' });

    await open('/dashboard');

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text()).toContain('Orçamentos de novembro de 2026');
      expect(text()).toContain('Próximo do limite');
      expect(text()).toMatch(/R\$\s90,00 de R\$\s100,00/);
    });
  });
});
