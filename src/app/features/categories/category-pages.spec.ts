import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { InMemoryCategoryRepository } from '../../../testing/in-memory-category.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { appConfig } from '../../app.config';
import { Category } from '../../shared/models/category';
import { DEFAULT_CATEGORIES } from './domain/default-categories';

describe('category pages', () => {
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

  function text(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  function rowNames(): string[] {
    const element = harness.routeNativeElement as HTMLElement;
    return [...element.querySelectorAll('.category-row__name')].map(
      (name) => name.textContent?.trim() ?? '',
    );
  }

  function records(): Category[] {
    return TestBed.inject(InMemoryCategoryRepository).records;
  }

  function seed(...categories: Partial<Category>[]): Category[] {
    const created = categories.map((overrides, index): Category => ({
      id: `category-${index + 1}`,
      userId,
      name: `Categoria ${index + 1}`,
      type: 'expense',
      icon: 'more_horiz',
      color: '#546e7a',
      isDefault: false,
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    }));
    records().push(...created);
    return created;
  }

  async function input(label: string): Promise<MatInputHarness> {
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    return (await field.getControl(MatInputHarness))!;
  }

  async function save(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Salvar' }))).click();
    await harness.fixture.whenStable();
  }

  describe('list', () => {
    it('creates and shows the default categories on the first access', async () => {
      await open('/categories');

      const expenses = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').length;
      expect(records()).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(rowNames()).toHaveLength(expenses);
      expect(rowNames()).toContain('Alimentação');
      expect(text()).toContain('Padrão');
      expect(text()).toContain(`Despesas (${expenses})`);
    });

    it('switches between expenses and incomes and searches by name', async () => {
      seed(
        { name: 'Mercado' },
        { name: 'Restaurante' },
        { name: 'Salário', type: 'income' },
        { name: 'Antiga', isArchived: true },
      );
      await open('/categories');
      expect(rowNames()).toEqual(['Mercado', 'Restaurante']);

      const types = await loader.getHarness(MatButtonToggleGroupHarness);
      await (await types.getToggles({ text: /Receitas/ }))[0].check();
      expect(rowNames()).toEqual(['Salário']);

      await (await types.getToggles({ text: /Despesas/ }))[0].check();
      await (await loader.getHarness(MatSlideToggleHarness)).check();
      expect(rowNames()).toEqual(['Antiga', 'Mercado', 'Restaurante']);

      await (
        await loader.getHarness(MatInputHarness.with({ selector: '[type="search"]' }))
      ).setValue('RESTAU');
      expect(rowNames()).toEqual(['Restaurante']);
    });

    it('opens the tab given by the type query param', async () => {
      seed({ name: 'Mercado' }, { name: 'Salário', type: 'income' });

      await open('/categories?type=income');

      expect(rowNames()).toEqual(['Salário']);
    });

    it('archives a category after confirmation', async () => {
      seed({ name: 'Mercado' }, { name: 'Lazer' });
      await open('/categories');

      const menu = await loader.getHarness(
        MatMenuHarness.with({ selector: '[aria-label="Ações da categoria Lazer"]' }),
      );
      await menu.clickItem({ text: /Arquivar/ });
      const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
        MatDialogHarness,
      );
      expect(await dialog.getText()).toContain('As transações já registradas continuam com ela');
      await (await dialog.getHarness(MatButtonHarness.with({ text: 'Arquivar' }))).click();

      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(rowNames()).toEqual(['Mercado']);
      });
      expect(records().find((c) => c.name === 'Lazer')?.isArchived).toBe(true);
    });
  });

  describe('form', () => {
    it('creates an income category preselected by the query param', async () => {
      seed({ name: 'Mercado' });
      await open('/categories/new?type=income');

      const types = await loader.getHarness(MatButtonToggleGroupHarness);
      expect(await (await types.getToggles({ checked: true }))[0].getText()).toBe('Receita');

      await (await input('Nome')).setValue('  Aluguel   recebido ');
      const iconField = await loader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: 'Ícone' }),
      );
      await (await iconField.getControl(MatSelectHarness))!.clickOptions({ text: 'Casa' });
      await save();

      expect(records()).toContainEqual(
        expect.objectContaining({
          name: 'Aluguel recebido',
          type: 'income',
          icon: 'home',
          isDefault: false,
        }),
      );
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/categories?type=income'));
    });

    it('shows an error on the name when it duplicates another category of the same type', async () => {
      seed({ name: 'Saúde', isArchived: true });
      await open('/categories/new');

      await (await input('Nome')).setValue('saude');
      await save();

      const nameField = await loader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: 'Nome' }),
      );
      expect(await nameField.getTextErrors()).toEqual([
        'Já existe uma categoria de despesa arquivada com este nome. Reative-a em vez de criar outra.',
      ]);
      expect(records()).toHaveLength(1);
    });

    it('requires a name', async () => {
      await open('/categories/new');

      await save();

      const nameField = await loader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: 'Nome' }),
      );
      expect(await nameField.getTextErrors()).toEqual(['Informe o nome da categoria.']);
    });

    it('edits a default category without allowing a type change', async () => {
      const [health] = seed({ name: 'Saúde', isDefault: true, icon: 'local_hospital' });
      await open(`/categories/${health.id}/edit`);

      expect(await loader.getAllHarnesses(MatButtonToggleGroupHarness)).toHaveLength(0);
      expect(text()).toContain('Tipo: Despesa');
      expect(text()).toContain('Esta é uma categoria padrão do aplicativo.');

      await (await input('Nome')).setValue('Saúde e bem-estar');
      await save();

      expect(records()[0]).toMatchObject({
        name: 'Saúde e bem-estar',
        type: 'expense',
        isDefault: true,
      });
    });
  });
});
