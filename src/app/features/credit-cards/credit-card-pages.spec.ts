import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../testing/account-fixtures';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedCreditCards } from '../../../testing/credit-card-fixtures';
import { InMemoryAccountRepository } from '../../../testing/in-memory-account.repository';
import { InMemoryCreditCardRepository } from '../../../testing/in-memory-credit-card.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { seedTransactions } from '../../../testing/transaction-fixtures';
import { appConfig } from '../../app.config';

describe('credit card pages', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    // Hoje nos testes: 15/11/2026.
    seedAccounts(userId, { name: 'Corrente' }, { name: 'Antiga', isArchived: true });
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

  function field(label: string | RegExp): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function input(label: string | RegExp): Promise<MatInputHarness> {
    return (await (await field(label)).getControl(MatInputHarness))!;
  }

  async function select(label: string | RegExp): Promise<MatSelectHarness> {
    return (await (await field(label)).getControl(MatSelectHarness))!;
  }

  async function save(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Salvar' }))).click();
    await harness.fixture.whenStable();
  }

  function records() {
    return TestBed.inject(InMemoryCreditCardRepository).records;
  }

  describe('list', () => {
    it('shows the empty state', async () => {
      await open('/credit-cards');

      expect(text()).toContain('Você ainda não cadastrou nenhum cartão.');
    });

    it('shows limits and the next invoice of the active cards', async () => {
      const [card] = seedCreditCards(
        userId,
        { name: 'Roxinho', lastFourDigits: '4321', creditLimit: 300_000 },
        { name: 'Velho', isArchived: true },
      );
      seedTransactions(
        userId,
        { accountId: null, creditCardId: card.id, amount: 50_000, date: '2026-11-02' },
        { accountId: null, creditCardId: card.id, amount: 12_345, date: '2026-11-10' },
      );

      await open('/credit-cards');

      const content = text();
      expect(content).toContain('Roxinho');
      expect(content).not.toContain('Velho');
      expect(content).toContain('•••• 4321');
      expect(content).toContain('1 cartão ativo');
      expect(content).toMatch(/Disponível\s*R\$\s*2\.376,55/);
      expect(content).toMatch(/Utilizado R\$\s*623,45 de R\$\s*3\.000,00/);
      // Fatura aberta em 15/11: fecha em 05/12 e vence em 12/12, com a compra de 10/11.
      expect(content).toMatch(/Próxima fatura\s*R\$\s*123,45/);
      expect(content).toContain('12/12/2026');

      await (await select('Status')).clickOptions({ text: 'Arquivados' });
      expect(text()).toContain('Velho');
      expect(text()).not.toContain('Roxinho');
    });
  });

  describe('form', () => {
    it('never asks for the full card number, CVV or password', async () => {
      await open('/credit-cards/new');

      const labels = await Promise.all(
        (await loader.getAllHarnesses(MatFormFieldHarness)).map((item) => item.getLabel()),
      );
      expect(labels).toContain('Últimos 4 dígitos');
      expect(labels.join(' ')).not.toMatch(/número do cartão|cvv|código de segurança|senha/i);

      const digits = await (await input('Últimos 4 dígitos')).host();
      expect(await digits.getAttribute('maxlength')).toBe('4');
    });

    it('validates the required fields and the days', async () => {
      await open('/credit-cards/new');
      await (await select('Dia de fechamento')).clickOptions({ text: '10' });
      await (await select('Dia de vencimento')).clickOptions({ text: '10' });
      await (await input('Últimos 4 dígitos')).setValue('12a');

      await save();

      expect(await (await field('Apelido do cartão')).getTextErrors()).toEqual([
        'Informe o apelido do cartão.',
      ]);
      expect(await (await field('Últimos 4 dígitos')).getTextErrors()).toEqual([
        'Informe exatamente quatro números.',
      ]);
      expect(await (await field('Limite')).getTextErrors()).toEqual(['Informe o limite.']);
      expect(await (await field('Dia de vencimento')).getTextErrors()).toEqual([
        'O vencimento deve ser diferente do fechamento.',
      ]);
      expect(records()).toHaveLength(0);
    });

    it('creates a card with the only active account preselected and opens its detail', async () => {
      await open('/credit-cards/new');
      await (await input('Apelido do cartão')).setValue('Roxinho');
      await (await select('Bandeira')).clickOptions({ text: 'Mastercard' });
      await (await input('Últimos 4 dígitos')).setValue('4321');
      await (await (await input('Limite')).host()).sendKeys('300000');
      await (await select('Dia de fechamento')).clickOptions({ text: '5' });
      await (await select('Dia de vencimento')).clickOptions({ text: '12' });
      expect(await (await select('Conta de pagamento')).getValueText()).toBe('Corrente');

      await save();

      expect(records()).toEqual([
        expect.objectContaining({
          name: 'Roxinho',
          brand: 'mastercard',
          lastFourDigits: '4321',
          creditLimit: 300_000,
          closingDay: 5,
          dueDay: 12,
          paymentAccountId: 'account-1',
        }),
      ]);
      expect(TestBed.inject(Router).url).toBe(`/credit-cards/${records()[0].id}`);
    });

    it('asks for an account when there is no active one', async () => {
      for (const account of TestBed.inject(InMemoryAccountRepository).records) {
        account.isArchived = true;
      }

      await open('/credit-cards/new');

      expect(text()).toContain('Cadastre uma conta antes');
    });
  });

  describe('detail', () => {
    it('shows the limits, the next invoice and the recent purchases', async () => {
      const [card] = seedCreditCards(userId, { name: 'Roxinho', creditLimit: 50_000 });
      seedTransactions(
        userId,
        {
          description: 'Notebook',
          accountId: null,
          creditCardId: card.id,
          amount: 60_000,
          date: '2026-11-08',
        },
        { description: 'Mercado', amount: 1_000 },
      );

      await open(`/credit-cards/${card.id}`);

      const content = text();
      expect(content).toContain('Roxinho');
      expect(content).toContain('Limite ultrapassado.');
      expect(content).toContain('Notebook');
      expect(content).not.toContain('Mercado');
      expect(content).toContain('Corrente');
      expect(content).toContain('05/12/2026');
    });

    it('archives the card after confirmation, keeping it', async () => {
      const [card] = seedCreditCards(userId, { name: 'Roxinho' });
      await open(`/credit-cards/${card.id}`);

      await (await loader.getHarness(MatButtonHarness.with({ text: /Arquivar/ }))).click();
      const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
        MatDialogHarness,
      );
      await (await dialog.getHarness(MatButtonHarness.with({ text: 'Arquivar' }))).click();

      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        expect(text()).not.toContain('Nova compra');
      });
      expect(records()[0].isArchived).toBe(true);
      expect(text()).toContain('Arquivado');
    });

    it('shows not found for a card of another user', async () => {
      seedCreditCards('someone-else', { name: 'Alheio' });

      await open('/credit-cards/card-1');

      expect(text()).toContain('Cartão não encontrado.');
      expect(text()).not.toContain('Alheio');
    });
  });
});
