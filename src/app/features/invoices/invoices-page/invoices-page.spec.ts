import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
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

  async function dialog(): Promise<MatDialogHarness> {
    return TestbedHarnessEnvironment.documentRootLoader(harness.fixture).getHarness(
      MatDialogHarness,
    );
  }

  async function confirm(label: string): Promise<void> {
    await (await (await dialog()).getHarness(MatButtonHarness.with({ text: label }))).click();
  }

  async function settle(expected: string): Promise<void> {
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text()).toContain(expected);
    });
  }

  function payments() {
    return TestBed.inject(InMemoryTransactionRepository).records.filter(
      (t) => t.type === 'invoice-payment',
    );
  }

  async function openPayment(): Promise<MatInputHarness> {
    await (await loader.getHarness(MatButtonHarness.with({ text: /Pagar fatura/ }))).click();
    return (await dialog()).getHarness(MatInputHarness);
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

  it('subtracts the refunds from the invoice and shows a credit without payment', async () => {
    seedPurchases();
    seedTransactions(userId, {
      type: 'refund',
      description: 'Estorno: Sapato',
      accountId: null,
      creditCardId: 'card-1',
      categoryId: null,
      amount: 15_000,
      date: '2026-11-12',
      refundedTransactionId: 'transaction-1',
    });

    await open('/invoices?creditCardId=card-1&month=2026-12');

    const content = text();
    expect(content).toContain('Compras (1) e estornos (1)');
    expect(content).toContain('Estorno: Sapato');
    expect(content).toMatch(/−R\$\s150,00/);
    expect(content).toMatch(/Crédito de R\$\s50,10/);
    expect(content).toContain(
      'Os estornos superam as compras: o crédito passa para a fatura seguinte.',
    );
    expect(content).not.toContain('Pagar');
  });

  it('pays the whole balance by default and undoes the payment', async () => {
    seedPurchases();
    await open('/invoices?creditCardId=card-1&month=2026-11');

    const amount = await openPayment();
    expect(await amount.getValue()).toBe('250,50');
    await confirm('Pagar');
    await settle('Fatura quitada.');
    expect(text()).toContain('Fatura Roxinho 11/2026');
    expect(payments()).toEqual([
      expect.objectContaining({ amount: 25_050, invoiceMonth: '2026-11', accountId: 'account-1' }),
    ]);

    await (
      await loader.getHarness(MatButtonHarness.with({ text: 'Desfazer último pagamento' }))
    ).click();
    await confirm('Desfazer');
    await settle('Vencida');
    expect(payments()).toEqual([]);
  });

  it('pays part of the balance and shows what is left', async () => {
    seedPurchases();
    await open('/invoices?creditCardId=card-1&month=2026-11');

    const amount = await openPayment();
    await amount.setValue('10000');
    await confirm('Pagar');
    await settle('Falta pagar');

    const content = text();
    expect(content).toMatch(/Falta pagar R\$\s150,50/);
    expect(content).toContain('Fatura Roxinho 11/2026 (parcial)');
    expect(payments()).toEqual([expect.objectContaining({ amount: 10_000 })]);
  });

  it('shows the balance carried over to the next invoice', async () => {
    seedPurchases();
    seedTransactions(userId, {
      description: 'Viagem',
      accountId: null,
      creditCardId: 'card-1',
      amount: 7_000,
      date: '2026-09-20',
    });
    await open('/invoices?creditCardId=card-1&month=2026-10');

    expect(text()).toContain('Transferida');
    expect(text()).toMatch(/R\$\s70,00 passou para a fatura 11\/2026/);
    expect(text()).not.toContain('Pagar fatura');

    await (
      await loader.getHarness(MatButtonHarness.with({ text: 'Ver a fatura 11/2026' }))
    ).click();
    await settle('Saldo anterior');
    // 70,00 de saldo anterior + 250,50 de compras.
    expect(text()).toMatch(/R\$\s320,50/);
  });

  it('does not pay more than the balance', async () => {
    seedPurchases();
    await open('/invoices?creditCardId=card-1&month=2026-11');

    const amount = await openPayment();
    await amount.setValue('30000');
    await confirm('Pagar');
    await harness.fixture.whenStable();

    expect(document.body.textContent).toContain(
      'O pagamento pode ser de no máximo R$ 250,50, o saldo da fatura.',
    );
    expect(payments()).toEqual([]);
  });
});
