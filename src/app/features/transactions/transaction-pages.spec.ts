import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MatDatepickerInputHarness } from '@angular/material/datepicker/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedCategories } from '../../../testing/category-fixtures';
import { seedCreditCards } from '../../../testing/credit-card-fixtures';
import { InMemoryAccountRepository } from '../../../testing/in-memory-account.repository';
import { InMemoryTransactionRepository } from '../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { appConfig } from '../../app.config';
import { PeriodService } from '../../core/services/period.service';
import { Transaction } from '../../shared/models/transaction';

describe('transaction pages', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    // Hoje nos testes: 15/11/2026.
    seedAccounts(
      userId,
      { name: 'Corrente', initialBalance: 100_000 },
      { name: 'Poupança' },
      { name: 'Antiga', isArchived: true },
    );
    seedCategories(
      userId,
      { name: 'Mercado', icon: 'shopping_cart' },
      { name: 'Salário', type: 'income', icon: 'work' },
      { name: 'Lazer' },
    );
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

  function rowDescriptions(): string[] {
    const element = harness.routeNativeElement as HTMLElement;
    return [...element.querySelectorAll('.transactions__link')].map(
      (link) => link.textContent?.trim() ?? '',
    );
  }

  function records(): Transaction[] {
    return TestBed.inject(InMemoryTransactionRepository).records;
  }

  async function field(label: string | RegExp): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function input(label: string | RegExp): Promise<MatInputHarness> {
    return (await (await field(label)).getControl(MatInputHarness))!;
  }

  async function select(label: string | RegExp): Promise<MatSelectHarness> {
    return (await (await field(label)).getControl(MatSelectHarness))!;
  }

  async function confirmDialog(button: string): Promise<void> {
    const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
    await (await dialog.getHarness(MatButtonHarness.with({ text: button }))).click();
  }

  async function save(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Salvar' }))).click();
    await harness.fixture.whenStable();
  }

  describe('list', () => {
    it('shows the empty state when there are no transactions', async () => {
      await open('/transactions');

      expect(text()).toContain('Nenhuma transação registrada ainda.');
    });

    it('lists the transactions of the selected period with the totals', async () => {
      seedTransactions(
        userId,
        { description: 'Mercado', amount: 25_090, date: '2026-11-03' },
        {
          description: 'Salário',
          type: 'income',
          categoryId: 'category-2',
          amount: 500_000,
          date: '2026-11-05',
        },
        {
          description: 'Reserva',
          type: 'transfer',
          categoryId: null,
          destinationAccountId: 'account-2',
          amount: 100_000,
          date: '2026-11-06',
        },
        { description: 'Conta pendente', amount: 9_900, date: '2026-11-07', status: 'pending' },
        { description: 'Outubro', date: '2026-10-20' },
      );

      await open('/transactions');

      expect(rowDescriptions()).toEqual(['Conta pendente', 'Reserva', 'Salário', 'Mercado']);
      expect(text()).toMatch(/Receitas\s*\+R\$\s5\.000,00/);
      expect(text()).toMatch(/Despesas\s*−R\$\s250,90/);
      expect(text()).toMatch(/Resultado\s*R\$\s4\.749,10/);
      expect(text()).toContain('1 transação pendente');
      expect(text()).toContain('Corrente → Poupança');

      TestBed.inject(PeriodService).select('last-3-months');
      await harness.fixture.whenStable();
      expect(rowDescriptions()).toContain('Outubro');
    });

    it('shows zeroed totals without sign or color', async () => {
      seedTransactions(userId, { description: 'Mercado', status: 'pending' });

      await open('/transactions');

      const values = harness.routeNativeElement!.querySelectorAll('.summary-card__value');
      expect([...values].map((value) => value.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        'R$ 0,00',
        'R$ 0,00',
        'R$ 0,00',
      ]);
      expect(harness.routeNativeElement!.querySelector('.summary-card__value--income')).toBeNull();
      expect(harness.routeNativeElement!.querySelector('.summary-card__value--expense')).toBeNull();
    });

    it('combines filters and accepts an account from the query param', async () => {
      seedTransactions(
        userId,
        { description: 'Mercado' },
        { description: 'Cinema', categoryId: 'category-3', accountId: 'account-2' },
        {
          description: 'Salário',
          type: 'income',
          categoryId: 'category-2',
          accountId: 'account-2',
        },
      );

      await open('/transactions?accountId=account-2');
      expect(rowDescriptions().sort()).toEqual(['Cinema', 'Salário']);

      await (await select('Tipo')).clickOptions({ text: 'Despesas' });
      expect(rowDescriptions()).toEqual(['Cinema']);

      await (await select('Tipo')).clickOptions({ text: 'Todos' });
      await (await select('Conta ou cartão')).clickOptions({ text: 'Todos' });
      await (await select('Categoria')).clickOptions({ text: 'Mercado' });
      expect(rowDescriptions()).toEqual(['Mercado']);
    });

    it('shows card purchases with the card name, filterable and without the pending action', async () => {
      seedCreditCards(userId, { name: 'Roxinho' });
      seedTransactions(
        userId,
        { description: 'Mercado' },
        { description: 'Notebook', accountId: null, creditCardId: 'card-1', amount: 350_000 },
      );

      await open('/transactions?creditCardId=card-1');

      expect(rowDescriptions()).toEqual(['Notebook']);
      expect(text()).toContain('Cartão Roxinho');
      expect(text()).toMatch(/Despesas\s*−R\$\s3\.500,00/);

      const menu = await loader.getHarness(
        MatMenuHarness.with({ selector: '[aria-label="Ações da transação Notebook"]' }),
      );
      await menu.open();
      const items = await Promise.all((await menu.getItems()).map((item) => item.getText()));
      expect(items.join(' ')).not.toMatch(/pendente/i);
    });

    it('shows invoice payments outside the totals and only allows deleting them', async () => {
      seedCreditCards(userId, { name: 'Roxinho' });
      seedTransactions(userId, {
        description: 'Fatura Roxinho 11/2026',
        type: 'invoice-payment',
        creditCardId: 'card-1',
        invoiceMonth: '2026-11',
        categoryId: null,
        amount: 20_000,
      });

      await open('/transactions');

      expect(text()).toContain('Corrente → Fatura Roxinho');
      expect(text()).toMatch(/Despesas\s*R\$\s0,00/);
      const menu = await loader.getHarness(
        MatMenuHarness.with({
          selector: '[aria-label="Ações da transação Fatura Roxinho 11/2026"]',
        }),
      );
      await menu.open();
      const items = await Promise.all((await menu.getItems()).map((item) => item.getText()));
      expect(items.join(' ')).not.toMatch(/Editar|pendente|realizada/i);
      expect(items.join(' ')).toMatch(/Excluir/);
    });

    it('does not open invoice payments in the transaction form', async () => {
      const [payment] = seedTransactions(userId, {
        type: 'invoice-payment',
        creditCardId: 'card-1',
        invoiceMonth: '2026-11',
        categoryId: null,
      });

      await open(`/transactions/${payment.id}/edit`);

      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).toContain('Pagamentos de fatura não são editados aqui.');
      });
    });

    it('restores the filters from the URL and keeps the applied ones in it', async () => {
      seedTransactions(
        userId,
        { description: 'Mercado' },
        { description: 'Salário', type: 'income', categoryId: 'category-2' },
        { description: 'Salário atrasado', type: 'income', categoryId: 'category-2' },
      );
      const router = TestBed.inject(Router);

      await open('/transactions?tipo=income&busca=atras&ordem=amount-desc');
      expect(rowDescriptions()).toEqual(['Salário atrasado']);

      await (await select('Tipo')).clickOptions({ text: 'Despesas' });
      await harness.fixture.whenStable();
      expect(router.parseUrl(router.url).queryParams).toEqual({
        busca: 'atras',
        ordem: 'amount-desc',
        tipo: 'expense',
      });
    });

    it('turns the link params of other pages into the filter params', async () => {
      await open('/transactions?accountId=account-2');

      expect(TestBed.inject(Router).url).toBe('/transactions?conta=account-2');
    });

    it('paginates page by page', async () => {
      seedTransactions(
        userId,
        ...Array.from({ length: 12 }, (_, index) => ({
          description: `Compra ${String(index + 1).padStart(2, '0')}`,
          date: `2026-11-${String(index + 1).padStart(2, '0')}`,
        })),
      );
      await open('/transactions');

      expect(rowDescriptions()).toHaveLength(10);
      const paginator = await loader.getHarness(MatPaginatorHarness);
      expect(await paginator.getRangeLabel()).toBe('1–10 de 12');

      await paginator.goToNextPage();
      expect(rowDescriptions()).toEqual(['Compra 02', 'Compra 01']);
    });

    it('marks a pending transaction as completed from the menu', async () => {
      seedTransactions(userId, { description: 'Aluguel', status: 'pending' });
      await open('/transactions');

      const menu = await loader.getHarness(
        MatMenuHarness.with({ selector: '[aria-label="Ações da transação Aluguel"]' }),
      );
      await menu.clickItem({ text: /Marcar como realizada/ });

      await vi.waitFor(() => expect(records()[0].status).toBe('completed'));
    });

    it('deletes a transaction after confirmation', async () => {
      seedTransactions(userId, { description: 'Engano' }, { description: 'Mercado' });
      await open('/transactions');

      const menu = await loader.getHarness(
        MatMenuHarness.with({ selector: '[aria-label="Ações da transação Engano"]' }),
      );
      await menu.clickItem({ text: /Excluir/ });
      await confirmDialog('Excluir');

      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(rowDescriptions()).toEqual(['Mercado']);
      });
      expect(records().map((t) => t.description)).toEqual(['Mercado']);
    });
  });

  describe('detail', () => {
    it('shows the transaction and deletes it after confirmation', async () => {
      const [transaction] = seedTransactions(userId, {
        description: 'Mercado do mês',
        amount: 25_090,
        status: 'pending',
        notes: 'Compra grande',
      });
      await open(`/transactions/${transaction.id}`);

      expect(text()).toContain('Mercado do mês');
      expect(text()).toMatch(/−R\$\s250,90/);
      expect(text()).toContain('10/11/2026');
      expect(text()).toContain('(não altera o saldo)');
      expect(text()).toContain('Compra grande');

      await (await loader.getHarness(MatButtonHarness.with({ text: /Excluir/ }))).click();
      await confirmDialog('Excluir');

      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/transactions'));
      expect(records()).toHaveLength(0);
    });
  });

  describe('form', () => {
    it('creates an expense with the amount in cents and today as the default date', async () => {
      await open('/transactions/new');

      await (await input('Descrição')).setValue('Feira');
      await (await input('Valor')).setValue('4590');
      await (await select('Conta')).clickOptions({ text: 'Corrente' });
      await (await select('Categoria')).clickOptions({ text: 'Mercado' });
      await save();

      expect(records()).toEqual([
        expect.objectContaining({
          type: 'expense',
          description: 'Feira',
          amount: 4_590,
          date: '2026-11-15',
          accountId: 'account-1',
          categoryId: 'category-1',
          destinationAccountId: null,
          status: 'completed',
          notes: null,
        }),
      ]);
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/transactions'));
    });

    it('accepts a date typed in the Brazilian format', async () => {
      await open('/transactions/new?accountId=account-1');

      await (await input('Descrição')).setValue('Farmácia');
      await (await input('Valor')).setValue('1000');
      const date = await loader.getHarness(MatDatepickerInputHarness);
      await date.setValue('03/11/2026');
      await (await select('Categoria')).clickOptions({ text: 'Lazer' });
      await save();

      expect(records()[0]).toMatchObject({ date: '2026-11-03', accountId: 'account-1' });
    });

    it('offers only active categories of the selected type and only active accounts', async () => {
      await open('/transactions/new');

      const types = await loader.getHarness(MatButtonToggleGroupHarness);
      await (await types.getToggles({ text: 'Receita' }))[0].check();
      const categories = await select('Categoria');
      await categories.open();
      expect((await categories.getOptions()).map((o) => o.getText())).toHaveLength(1);
      expect(await (await categories.getOptions())[0].getText()).toContain('Salário');
      await categories.close();

      const accounts = await select('Conta');
      await accounts.open();
      const accountNames = await Promise.all((await accounts.getOptions()).map((o) => o.getText()));
      expect(accountNames).toEqual(['Corrente', 'Poupança']);
    });

    it('validates transfers between different accounts and hides the category', async () => {
      await open('/transactions/new');

      const types = await loader.getHarness(MatButtonToggleGroupHarness);
      await (await types.getToggles({ text: 'Transferência' }))[0].check();
      expect(
        await loader.getAllHarnesses(MatFormFieldHarness.with({ floatingLabelText: 'Categoria' })),
      ).toHaveLength(0);

      await (await input('Descrição')).setValue('Reserva');
      await (await input('Valor')).setValue('50000');
      await (await select('Conta de origem')).clickOptions({ text: 'Corrente' });
      await (await select('Conta de destino')).clickOptions({ text: 'Corrente' });
      await save();

      expect(await (await field('Conta de destino')).getTextErrors()).toEqual([
        'Escolha uma conta diferente da conta de origem.',
      ]);
      expect(records()).toHaveLength(0);

      await (await select('Conta de destino')).clickOptions({ text: 'Poupança' });
      await save();

      expect(records()[0]).toMatchObject({
        type: 'transfer',
        accountId: 'account-1',
        destinationAccountId: 'account-2',
        categoryId: null,
        amount: 50_000,
      });
    });

    it('requires the main fields', async () => {
      await open('/transactions/new');

      await save();

      expect(await (await field('Descrição')).getTextErrors()).toEqual(['Informe a descrição.']);
      expect(await (await field('Valor')).getTextErrors()).toEqual(['Informe o valor.']);
      expect(await (await field('Categoria')).getTextErrors()).toEqual(['Selecione a categoria.']);
    });

    it('edits a transaction, keeping its archived account available', async () => {
      const [transaction] = seedTransactions(userId, {
        description: 'Antiga',
        accountId: 'account-3',
        amount: 12_345,
      });
      await open(`/transactions/${transaction.id}/edit`);

      expect(await (await input('Valor')).getValue()).toBe('123,45');
      expect(await (await select('Conta')).getValueText()).toBe('Antiga (arquivada)');

      const status = (await loader.getAllHarnesses(MatButtonToggleGroupHarness))[1];
      await (await status.getToggles({ text: 'Pendente' }))[0].check();
      await save();

      expect(records()[0]).toMatchObject({ status: 'pending', accountId: 'account-3' });
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/transactions/${transaction.id}`),
      );
    });

    it('registers a card purchase without account or status', async () => {
      seedCreditCards(
        userId,
        { name: 'Roxinho', lastFourDigits: '4321' },
        { name: 'Velho', isArchived: true },
      );
      await open('/transactions/new');

      const groups = await loader.getAllHarnesses(MatButtonToggleGroupHarness);
      await (await groups[1].getToggles({ text: 'Cartão de crédito' }))[0].check();
      expect(
        await loader.getAllHarnesses(MatFormFieldHarness.with({ floatingLabelText: 'Conta' })),
      ).toHaveLength(0);
      expect(text()).not.toContain('Pendente');

      const cards = await select('Cartão');
      await cards.open();
      const cardNames = await Promise.all((await cards.getOptions()).map((o) => o.getText()));
      expect(cardNames).toEqual(['Roxinho •••• 4321']);
      await cards.close();

      await save();
      expect(await (await field('Cartão')).getTextErrors()).toEqual(['Selecione o cartão.']);

      await (await input('Descrição')).setValue('Notebook');
      await (await input('Valor')).setValue('350000');
      await cards.clickOptions({ text: /Roxinho/ });
      await (await select('Categoria')).clickOptions({ text: 'Lazer' });
      await save();

      expect(records()).toEqual([
        expect.objectContaining({
          type: 'expense',
          accountId: null,
          creditCardId: 'card-1',
          status: 'completed',
          amount: 350_000,
        }),
      ]);
    });

    it('preselects the card from the query param of "Nova compra"', async () => {
      seedCreditCards(userId, { name: 'Roxinho' });

      await open('/transactions/new?creditCardId=card-1');

      expect(await (await select('Cartão')).getValueText()).toContain('Roxinho');
    });

    it('asks for an account when there is no active one', async () => {
      for (const account of TestBed.inject(InMemoryAccountRepository).records) {
        account.isArchived = true;
      }

      await open('/transactions/new');

      expect(text()).toContain('Cadastre uma conta antes de registrar transações.');
    });
  });
});
