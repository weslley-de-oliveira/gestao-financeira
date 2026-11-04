import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { seedAccounts } from '../../../../testing/account-fixtures';
import { signInTestUser } from '../../../../testing/auth-fixtures';
import { seedCreditCards } from '../../../../testing/credit-card-fixtures';
import { InMemoryTransactionRepository } from '../../../../testing/in-memory-transaction.repository';
import { TEST_PROVIDERS } from '../../../../testing/test-providers';
import { seedTransactions } from '../../../../testing/transaction-fixtures';
import { appConfig } from '../../../app.config';

describe('InvoicesPage', () => {
  let harness: RouterTestingHarness;
  let loader: HarnessLoader;
  let userId: string;

  // Hoje: 15/11/2026. Cartões fecham dia 5 e vencem dia 12.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...TEST_PROVIDERS] });
    userId = await signInTestUser();
    seedAccounts(userId, { name: 'Corrente' });
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

  async function select(label: string): Promise<MatSelectHarness> {
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    return (await field.getControl(MatSelectHarness))!;
  }

  async function confirm(label: string): Promise<void> {
    const dialog = await TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
    await (await dialog.getHarness(MatButtonHarness.with({ text: label }))).click();
  }

  function seedPurchases(): void {
    seedCreditCards(userId, { name: 'Roxinho' }, { name: 'Azul', lastFourDigits: '9999' });
    seedTransactions(
      userId,
      {
        description: 'Sapato',
        accountId: null,
        creditCardId: 'card-1',
        amount: 20_000,
        date: '2026-10-20',
      },
      {
        description: 'Farmácia',
        accountId: null,
        creditCardId: 'card-1',
        amount: 5_050,
        date: '2026-11-04',
      },
      {
        description: 'Notebook',
        accountId: null,
        creditCardId: 'card-1',
        amount: 9_990,
        date: '2026-11-10',
      },
      { description: 'Mercado', amount: 1_000 },
    );
  }

  it('asks for a card when there is none', async () => {
    await open('/invoices');

    expect(text()).toContain('Cadastre um cartão de crédito');
  });

  it('opens the current open invoice of the first card by default', async () => {
    seedPurchases();

    await open('/invoices');

    expect(text()).toContain('Fatura 12/2026 · Azul');
    expect(await (await select('Cartão')).getValueText()).toContain('Azul');
    expect(text()).toContain('Aberta');
    expect(text()).toContain('Nenhuma compra nesta fatura.');
  });

  it('shows the selected invoice with its items, total and status from the query params', async () => {
    seedPurchases();

    await open('/invoices?creditCardId=card-1&month=2026-11');

    const content = text();
    expect(content).toContain('Fatura 11/2026 · Roxinho');
    expect(content).toContain('Vencida');
    expect(content).toContain('Venceu em 12/11/2026.');
    expect(content).toContain('Sapato');
    expect(content).toContain('Farmácia');
    expect(content).not.toContain('Notebook');
    expect(content).not.toContain('Mercado');
    expect(content).toMatch(/Total\s*R\$\s250,50/);
    expect(content).toContain('Histórico do cartão');

    await (await select('Mês de referência')).clickOptions({ text: /12\/2026/ });
    await harness.fixture.whenStable();
    expect(text()).toContain('Notebook');
    expect(text()).toContain('O pagamento fica disponível depois do fechamento.');
  });

  it('pays the invoice after confirmation and undoes the payment', async () => {
    seedPurchases();
    await open('/invoices?creditCardId=card-1&month=2026-11');

    await (await loader.getHarness(MatButtonHarness.with({ text: /Pagar R\$/ }))).click();
    await confirm('Pagar');
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text()).toContain('Paga em 15/11/2026');
    });
    const records = TestBed.inject(InMemoryTransactionRepository).records;
    expect(records.filter((t) => t.type === 'invoice-payment')).toEqual([
      expect.objectContaining({ amount: 25_050, invoiceMonth: '2026-11', accountId: 'account-1' }),
    ]);

    await (await loader.getHarness(MatButtonHarness.with({ text: 'Desfazer pagamento' }))).click();
    await confirm('Desfazer');
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text()).toContain('Vencida');
    });
    expect(records.some((t) => t.type === 'invoice-payment')).toBe(false);
  });
});
