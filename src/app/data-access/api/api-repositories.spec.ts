import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Goal } from '../../shared/models/goal';
import { Transaction } from '../../shared/models/transaction';
import { ApiAccountRepository } from './api-account.repository';
import { ApiBudgetProgressRepository } from './api-budget-progress.repository';
import { ApiBudgetRepository } from './api-budget.repository';
import { ApiCategoryRepository } from './api-category.repository';
import { ApiDashboardRepository } from './api-dashboard.repository';
import { ApiGoalRepository } from './api-goal.repository';
import { ApiInstallmentPurchaseRepository } from './api-installment-purchase.repository';
import { ApiInvoiceRepository } from './api-invoice.repository';
import { SessionUser } from './api-http';
import { ApiTransactionRepository } from './api-transaction.repository';
import { API_BASE_URL } from './api.config';
import type { ApiAccount, ApiBudget, ApiGoal, ApiInvoice, ApiTransaction } from './api-types';

const USER_ID = '0190f1a2-0000-7000-8000-000000000001';
const ACCOUNT_ID = '0190f1a2-0000-7000-8000-0000000000a1';
const CARD_ID = '0190f1a2-0000-7000-8000-0000000000c1';
const CATEGORY_ID = '0190f1a2-0000-7000-8000-0000000000e1';

const apiAccount: ApiAccount = {
  id: ACCOUNT_ID,
  name: 'Conta corrente',
  type: 'checking',
  institution: 'Banco Exemplo',
  initialBalance: 100_000,
  currentBalance: 125_000,
  color: '#1565c0',
  icon: 'account_balance',
  isArchived: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
};

function apiTransaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: '0190f1a2-0000-7000-8000-0000000000f1',
    type: 'expense',
    description: 'Mercado do mês',
    amount: 25_000,
    date: '2026-11-05',
    accountId: ACCOUNT_ID,
    creditCardId: null,
    invoiceMonth: null,
    destinationAccountId: null,
    categoryId: CATEGORY_ID,
    status: 'completed',
    notes: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentCount: null,
    refundedTransactionId: null,
    createdAt: '2026-11-05T12:00:00.000Z',
    updatedAt: '2026-11-05T12:00:00.000Z',
    ...overrides,
  };
}

const apiGoal: ApiGoal = {
  id: '0190f1a2-0000-7000-8000-0000000000b1',
  name: 'Reserva',
  description: null,
  targetAmount: 1_000_000,
  initialAmount: 0,
  deadline: null,
  color: '#2e7d32',
  icon: 'savings',
  isPaused: false,
  isArchived: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  contributions: [],
  currentAmount: 0,
  remainingAmount: 1_000_000,
  excessAmount: 0,
  percent: 0,
  status: 'in-progress',
  monthsLeft: null,
  monthlyPace: null,
};

describe('API repositories', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: SessionUser, useValue: { id: () => USER_ID } },
        ApiAccountRepository,
        ApiCategoryRepository,
        ApiTransactionRepository,
        ApiBudgetRepository,
        ApiBudgetProgressRepository,
        ApiGoalRepository,
        ApiDashboardRepository,
        ApiInvoiceRepository,
        ApiInstallmentPurchaseRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('accounts', () => {
    it('lists archived accounts too, with the owner from the session and the server balance', async () => {
      const list = firstValueFrom(TestBed.inject(ApiAccountRepository).listByUser());
      http
        .expectOne({ url: '/api/v1/accounts?includeArchived=true', method: 'GET' })
        .flush([apiAccount]);

      const [account] = await list;
      expect(account.userId).toBe(USER_ID);
      expect(account.currentBalance).toBe(125_000);
    });

    it('returns null when the account is not found (404)', async () => {
      const found = firstValueFrom(TestBed.inject(ApiAccountRepository).findById('outra'));
      http
        .expectOne('/api/v1/accounts/outra')
        .flush({ status: 404 }, { status: 404, statusText: 'Not Found' });

      expect(await found).toBeNull();
    });

    it('creates without the fields the server owns', async () => {
      const created = firstValueFrom(
        TestBed.inject(ApiAccountRepository).create({
          userId: USER_ID,
          name: 'Conta corrente',
          type: 'checking',
          institution: 'Banco Exemplo',
          initialBalance: 100_000,
          color: '#1565c0',
          icon: 'account_balance',
          isArchived: false,
        }),
      );
      const request = http.expectOne({ url: '/api/v1/accounts', method: 'POST' });
      expect(request.request.body).toEqual({
        name: 'Conta corrente',
        type: 'checking',
        institution: 'Banco Exemplo',
        initialBalance: 100_000,
        color: '#1565c0',
        icon: 'account_balance',
      });
      request.flush(apiAccount);

      expect((await created).id).toBe(ACCOUNT_ID);
    });
  });

  describe('optimistic concurrency', () => {
    it('reads the version and sends it back as If-Match when saving', async () => {
      const repository = TestBed.inject(ApiAccountRepository);
      const found = firstValueFrom(repository.findById(ACCOUNT_ID));
      http.expectOne(`/api/v1/accounts/${ACCOUNT_ID}`).flush(apiAccount);
      const account = await found;
      expect(account?.updatedAt).toBe(apiAccount.updatedAt);

      const saved = firstValueFrom(
        repository.update(ACCOUNT_ID, { name: 'Conta nova' }, account?.updatedAt),
      );
      const request = http.expectOne({ url: `/api/v1/accounts/${ACCOUNT_ID}`, method: 'PATCH' });
      expect(request.request.headers.get('If-Match')).toBe(`"${Date.parse(apiAccount.updatedAt)}"`);
      request.flush({ ...apiAccount, name: 'Conta nova' });
      await saved;

      // Sem versão (ex.: arquivar pela lista), a edição vale sobre a versão atual.
      const archived = firstValueFrom(repository.update(ACCOUNT_ID, { isArchived: true }));
      const archive = http.expectOne({ url: `/api/v1/accounts/${ACCOUNT_ID}`, method: 'PATCH' });
      expect(archive.request.headers.has('If-Match')).toBe(false);
      archive.flush({ ...apiAccount, isArchived: true });
      await archived;
    });
  });

  describe('categories', () => {
    it('updates only the editable fields (never the type)', async () => {
      const updated = firstValueFrom(
        TestBed.inject(ApiCategoryRepository).update(CATEGORY_ID, {
          name: 'Mercado',
          isArchived: true,
        }),
      );
      const request = http.expectOne({
        url: `/api/v1/categories/${CATEGORY_ID}`,
        method: 'PATCH',
      });
      expect(request.request.body).toEqual({ name: 'Mercado', isArchived: true });
      request.flush({
        id: CATEGORY_ID,
        name: 'Mercado',
        type: 'expense',
        icon: 'shopping_cart',
        color: '#2e7d32',
        isDefault: false,
        isArchived: true,
        transactionCount: 7,
        createdAt: '2026-11-01T12:00:00.000Z',
      });

      expect(await updated).toMatchObject({ isArchived: true, transactionCount: 7 });
    });
  });

  describe('transactions', () => {
    it('asks for one page with the filters, the sort and the cursor', async () => {
      const page = firstValueFrom(
        TestBed.inject(ApiTransactionRepository).query(USER_ID, {
          filters: {
            range: { start: '2026-11-01', end: '2026-11-30' },
            type: 'expense',
            creditCardId: CARD_ID,
            search: '  mercado ',
          },
          sort: 'amount-desc',
          cursor: 'c1',
          limit: 25,
        }),
      );
      http
        .expectOne(
          `/api/v1/transactions?from=2026-11-01&to=2026-11-30&type=expense&creditCardId=${CARD_ID}&q=mercado&sort=amount-desc&limit=25&cursor=c1`,
        )
        .flush({ items: [apiTransaction({ id: 'a' })], nextCursor: 'c2' });

      const { items, nextCursor } = await page;
      expect(items.map((item) => [item.id, item.userId])).toEqual([['a', USER_ID]]);
      expect(nextCursor).toBe('c2');
    });

    it('asks for the totals of the filtered transactions, without sort or page', async () => {
      const totals = { count: 3, income: 0, expense: 30_000, net: -30_000, pendingCount: 1 };
      const summary = firstValueFrom(
        TestBed.inject(ApiTransactionRepository).summarize(USER_ID, {
          accountId: ACCOUNT_ID,
          status: 'pending',
          search: '   ',
        }),
      );
      http
        .expectOne(`/api/v1/transactions/summary?status=pending&accountId=${ACCOUNT_ID}`)
        .flush(totals);

      expect(await summary).toEqual(totals);
    });

    it('creates a card purchase without an account and a transfer without a category', async () => {
      const repository = TestBed.inject(ApiTransactionRepository);
      const base: Omit<Transaction, 'id' | 'createdAt'> = {
        userId: USER_ID,
        type: 'expense',
        description: 'Mercado do mês',
        amount: 25_000,
        date: '2026-11-05',
        accountId: null,
        creditCardId: CARD_ID,
        invoiceMonth: null,
        destinationAccountId: null,
        categoryId: CATEGORY_ID,
        status: 'completed',
        notes: null,
      };

      const purchase = firstValueFrom(repository.create(base));
      const purchaseRequest = http.expectOne({ url: '/api/v1/transactions', method: 'POST' });
      expect(purchaseRequest.request.body).toEqual({
        type: 'expense',
        description: 'Mercado do mês',
        amount: 25_000,
        date: '2026-11-05',
        status: 'completed',
        notes: null,
        categoryId: CATEGORY_ID,
        creditCardId: CARD_ID,
      });
      purchaseRequest.flush(apiTransaction({ accountId: null, creditCardId: CARD_ID }));
      await purchase;

      const transfer = firstValueFrom(
        repository.create({
          ...base,
          type: 'transfer',
          accountId: ACCOUNT_ID,
          creditCardId: null,
          destinationAccountId: 'destino',
          categoryId: null,
        }),
      );
      const transferRequest = http.expectOne({ url: '/api/v1/transactions', method: 'POST' });
      expect(transferRequest.request.body).toEqual({
        type: 'transfer',
        description: 'Mercado do mês',
        amount: 25_000,
        date: '2026-11-05',
        status: 'completed',
        notes: null,
        accountId: ACCOUNT_ID,
        destinationAccountId: 'destino',
      });
      transferRequest.flush(apiTransaction({ type: 'transfer', categoryId: null }));
      await transfer;
    });

    it('leaves empty links out of the update, but keeps cleared notes', async () => {
      const updated = firstValueFrom(
        TestBed.inject(ApiTransactionRepository).update('t1', {
          type: 'expense',
          accountId: ACCOUNT_ID,
          creditCardId: null,
          destinationAccountId: null,
          categoryId: CATEGORY_ID,
          invoiceMonth: null,
          notes: null,
        }),
      );
      const request = http.expectOne({ url: '/api/v1/transactions/t1', method: 'PATCH' });
      expect(request.request.body).toEqual({
        type: 'expense',
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        notes: null,
      });
      request.flush(apiTransaction());
      await updated;
    });

    it('pays and undoes an invoice through the invoice payment route', async () => {
      const repository = TestBed.inject(ApiTransactionRepository);
      const payment = apiTransaction({
        type: 'invoice-payment',
        creditCardId: CARD_ID,
        invoiceMonth: '2026-11',
        categoryId: null,
      });
      const url = `/api/v1/credit-cards/${CARD_ID}/invoices/2026-11/payment`;

      const paid = firstValueFrom(
        repository.payInvoice({
          userId: USER_ID,
          type: 'invoice-payment',
          description: 'Pagamento de fatura',
          amount: 25_000,
          date: '2026-11-05',
          accountId: ACCOUNT_ID,
          creditCardId: CARD_ID,
          invoiceMonth: '2026-11',
          destinationAccountId: null,
          categoryId: null,
          status: 'completed',
          notes: null,
        }),
      );
      const payRequest = http.expectOne({ url, method: 'POST' });
      expect(payRequest.request.body).toBeNull();
      payRequest.flush({ payment } as Partial<ApiInvoice>);
      expect((await paid).type).toBe('invoice-payment');

      const undone = firstValueFrom(repository.undoInvoicePayment({ ...payment, userId: USER_ID }));
      http.expectOne({ url, method: 'DELETE' }).flush({ payment: null } as Partial<ApiInvoice>);
      await expect(undone).resolves.toBeUndefined();
    });
  });

  describe('invoices', () => {
    const cycle = {
      referenceMonth: '2026-11',
      start: '2026-10-05',
      end: '2026-11-04',
      closingDate: '2026-11-05',
      dueDate: '2026-11-12',
      creditCardId: CARD_ID,
      total: 25_000,
      status: 'paid' as const,
      payment: apiTransaction({
        id: 'payment',
        type: 'invoice-payment',
        creditCardId: CARD_ID,
        invoiceMonth: '2026-11',
        categoryId: null,
      }),
    };

    it('lists the invoices of the card computed by the server', async () => {
      const list = firstValueFrom(
        TestBed.inject(ApiInvoiceRepository).listByCard(USER_ID, CARD_ID),
      );
      http
        .expectOne(`/api/v1/credit-cards/${CARD_ID}/invoices`)
        .flush([{ ...cycle, purchaseCount: 1 }]);

      const [invoice] = await list;
      expect(invoice).toMatchObject({ referenceMonth: '2026-11', purchaseCount: 1, total: 25_000 });
      expect(invoice.payment).toMatchObject({ id: 'payment', userId: USER_ID });
    });

    it('loads one invoice with its purchases, and null for an unknown card', async () => {
      const repository = TestBed.inject(ApiInvoiceRepository);
      const found = firstValueFrom(repository.findByMonth(USER_ID, CARD_ID, '2026-11'));
      http
        .expectOne(`/api/v1/credit-cards/${CARD_ID}/invoices/2026-11`)
        .flush({ ...cycle, purchases: [apiTransaction({ id: 'p1', accountId: null })] });
      const missing = firstValueFrom(repository.findByMonth(USER_ID, 'outro', '2026-11'));
      http
        .expectOne('/api/v1/credit-cards/outro/invoices/2026-11')
        .flush({ status: 404 }, { status: 404, statusText: 'Not Found' });

      expect((await found)?.purchases.map((purchase) => [purchase.id, purchase.userId])).toEqual([
        ['p1', USER_ID],
      ]);
      expect(await missing).toBeNull();
    });
  });

  describe('installment purchases', () => {
    const apiPurchase = {
      id: 'group',
      description: 'Geladeira',
      amount: 10_000,
      installmentCount: 2,
      creditCardId: CARD_ID,
      categoryId: CATEGORY_ID,
      notes: null,
      installments: [1, 2].map((installmentNumber) =>
        apiTransaction({
          id: `p${installmentNumber}`,
          accountId: null,
          creditCardId: CARD_ID,
          amount: 5_000,
          installmentGroupId: 'group',
          installmentNumber,
          installmentCount: 2,
        }),
      ),
    };

    it('creates with an Idempotency-Key and maps the installments', async () => {
      const created = firstValueFrom(
        TestBed.inject(ApiInstallmentPurchaseRepository).create(USER_ID, {
          description: 'Geladeira',
          amount: 10_000,
          date: '2026-11-10',
          creditCardId: CARD_ID,
          categoryId: CATEGORY_ID,
          installmentCount: 2,
          notes: null,
        }),
      );
      const request = http.expectOne({ url: '/api/v1/installment-purchases', method: 'POST' });
      expect(request.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
      expect(request.request.body).toEqual({
        description: 'Geladeira',
        amount: 10_000,
        date: '2026-11-10',
        creditCardId: CARD_ID,
        categoryId: CATEGORY_ID,
        installmentCount: 2,
        notes: null,
      });
      request.flush(apiPurchase);

      const purchase = await created;
      expect(purchase).toMatchObject({ id: 'group', userId: USER_ID, installmentCount: 2 });
      expect(
        purchase.installments.map((item) => [item.id, item.userId, item.installmentNumber]),
      ).toEqual([
        ['p1', USER_ID, 1],
        ['p2', USER_ID, 2],
      ]);
    });

    it('updates only description, category and notes, and deletes the purchase', async () => {
      const repository = TestBed.inject(ApiInstallmentPurchaseRepository);
      const updated = firstValueFrom(
        repository.update(USER_ID, 'group', { description: 'Geladeira nova', notes: null }),
      );
      const patch = http.expectOne({ url: '/api/v1/installment-purchases/group', method: 'PATCH' });
      expect(patch.request.body).toEqual({ description: 'Geladeira nova', notes: null });
      patch.flush(apiPurchase);
      await updated;

      const deleted = firstValueFrom(repository.delete(USER_ID, 'group'));
      http
        .expectOne({ url: '/api/v1/installment-purchases/group', method: 'DELETE' })
        .flush(null, { status: 204, statusText: 'No Content' });
      await deleted;
    });
  });

  describe('invoice payment', () => {
    const url = `/api/v1/credit-cards/${CARD_ID}/invoices/2026-11/payment`;
    const payment: Omit<Transaction, 'id' | 'createdAt'> = {
      userId: USER_ID,
      type: 'invoice-payment',
      description: 'Pagamento de fatura',
      amount: 25_000,
      date: '2026-11-05',
      accountId: ACCOUNT_ID,
      creditCardId: CARD_ID,
      invoiceMonth: '2026-11',
      destinationAccountId: null,
      categoryId: null,
      status: 'completed',
      notes: null,
    };
    const paid = apiTransaction({
      type: 'invoice-payment',
      creditCardId: CARD_ID,
      invoiceMonth: '2026-11',
      categoryId: null,
    });

    it('repeats a payment whose response was lost with the same Idempotency-Key', async () => {
      vi.useFakeTimers();
      try {
        const result = firstValueFrom(TestBed.inject(ApiTransactionRepository).payInvoice(payment));
        const first = http.expectOne({ url, method: 'POST' });
        const key = first.request.headers.get('Idempotency-Key');
        expect(key).toMatch(/^[0-9a-f-]{36}$/);
        first.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

        await vi.advanceTimersByTimeAsync(1000);
        const retry = http.expectOne({ url, method: 'POST' });
        expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
        retry.flush({ payment: paid } as Partial<ApiInvoice>, {
          headers: { 'Idempotent-Replayed': 'true' },
        });

        expect((await result).type).toBe('invoice-payment');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not repeat a payment the API refused, and uses a new key each time', async () => {
      const repository = TestBed.inject(ApiTransactionRepository);
      const refused = firstValueFrom(repository.payInvoice(payment));
      const first = http.expectOne({ url, method: 'POST' });
      first.flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
      await expect(refused).rejects.toMatchObject({ status: 409 });

      const next = firstValueFrom(repository.payInvoice(payment));
      const second = http.expectOne({ url, method: 'POST' });
      expect(second.request.headers.get('Idempotency-Key')).not.toBe(
        first.request.headers.get('Idempotency-Key'),
      );
      second.flush({ payment: paid } as Partial<ApiInvoice>);
      await next;
    });
  });

  describe('dashboard', () => {
    it('asks the API for the summary of the period and maps it to the app models', async () => {
      const summary = firstValueFrom(
        TestBed.inject(ApiDashboardRepository).load(USER_ID, {
          start: '2026-11-01',
          end: '2026-11-30',
        }),
      );
      const request = http.expectOne(
        (req) => req.url === '/api/v1/dashboard' && req.method === 'GET',
      );
      expect(request.request.params.get('from')).toBe('2026-11-01');
      expect(request.request.params.get('to')).toBe('2026-11-30');
      request.flush({
        from: '2026-11-01',
        to: '2026-11-30',
        summary: { income: 500_000, expense: 25_000, net: 475_000, pendingCount: 1 },
        balance: { total: 125_000, activeAccounts: 1 },
        incomeVsExpense: [
          { label: '01–07', start: '2026-11-01', end: '2026-11-07', income: 500_000, expense: 0 },
        ],
        balanceEvolution: [{ date: '2026-11-01', balance: 100_000 }],
        recentTransactions: [apiTransaction()],
        budgetHighlights: [
          {
            id: 'b1',
            categoryId: CATEGORY_ID,
            alertThreshold: 80,
            limitAmount: 50_000,
            limits: [{ month: '2026-11', amount: 50_000 }],
            progress: {
              month: '2026-11',
              limit: 50_000,
              spent: 25_000,
              pending: 0,
              available: 25_000,
              percent: 50,
              state: 'ok',
            },
            createdAt: '2026-11-01T12:00:00.000Z',
            updatedAt: '2026-11-01T12:00:00.000Z',
          },
        ],
        goalHighlights: [apiGoal],
      });

      const dashboard = await summary;
      expect(dashboard.summary.pendingCount).toBe(1);
      expect(dashboard.incomeVsExpense).toEqual([{ label: '01–07', income: 500_000, expense: 0 }]);
      expect(dashboard.recentTransactions[0].userId).toBe(USER_ID);
      expect(dashboard.budgetHighlights[0]).toMatchObject({
        budget: { id: 'b1', userId: USER_ID },
        spent: 25_000,
        state: 'ok',
      });
      expect(dashboard.goalHighlights[0]).toMatchObject({
        id: apiGoal.id,
        userId: USER_ID,
        status: 'in-progress',
      });
    });
  });

  describe('budgets', () => {
    it('sends only the current limit and keeps the history from the response', async () => {
      const apiBudget: ApiBudget = {
        id: 'b1',
        categoryId: CATEGORY_ID,
        alertThreshold: 80,
        limitAmount: 90_000,
        limits: [
          { month: '2026-10', amount: 80_000 },
          { month: '2026-11', amount: 90_000 },
        ],
        progress: null,
        createdAt: '2026-10-01T12:00:00.000Z',
        updatedAt: '2026-11-01T12:00:00.000Z',
      };

      const updated = firstValueFrom(
        TestBed.inject(ApiBudgetRepository).update('b1', {
          limits: apiBudget.limits,
          alertThreshold: 80,
        }),
      );
      const request = http.expectOne({ url: '/api/v1/budgets/b1', method: 'PATCH' });
      expect(request.request.body).toEqual({ limitAmount: 90_000, alertThreshold: 80 });
      request.flush(apiBudget);

      expect((await updated).limits).toEqual(apiBudget.limits);
    });

    it('reads the consumption of the month computed by the server', async () => {
      const budget = (id: string, progress: ApiBudget['progress']): ApiBudget => ({
        id,
        categoryId: CATEGORY_ID,
        alertThreshold: 80,
        limitAmount: 90_000,
        limits: [{ month: '2026-11', amount: 90_000 }],
        progress,
        createdAt: '2026-11-01T12:00:00.000Z',
        updatedAt: '2026-11-01T12:00:00.000Z',
      });
      const progress = {
        month: '2026-11',
        limit: 90_000,
        spent: 81_000,
        pending: 5_000,
        available: 9_000,
        percent: 90,
        state: 'warning' as const,
      };

      const list = firstValueFrom(
        TestBed.inject(ApiBudgetProgressRepository).listByMonth(USER_ID, '2026-11'),
      );
      http
        .expectOne('/api/v1/budgets?month=2026-11')
        .flush([budget('b1', progress), budget('b2', null)]);

      const [item, ...rest] = await list;
      expect(rest).toEqual([]);
      expect(item).toMatchObject(progress);
      expect(item.budget).toMatchObject({ id: 'b1', userId: USER_ID });
    });
  });

  describe('goals', () => {
    it('adds and removes contributions through their own routes', async () => {
      const repository = TestBed.inject(ApiGoalRepository);
      const goal: Goal = {
        ...apiGoal,
        userId: USER_ID,
        contributions: [],
      };
      const contribution = {
        id: 'c1',
        type: 'deposit' as const,
        amount: 10_000,
        date: '2026-11-05',
        note: null,
        createdAt: '2026-11-05T12:00:00.000Z',
      };

      const added = firstValueFrom(
        repository.addContribution(goal, {
          type: 'deposit',
          amount: 10_000,
          date: '2026-11-05',
          note: null,
        }),
      );
      const addRequest = http.expectOne({
        url: `/api/v1/goals/${goal.id}/contributions`,
        method: 'POST',
      });
      expect(addRequest.request.body).toEqual({
        type: 'deposit',
        amount: 10_000,
        date: '2026-11-05',
        note: null,
      });
      addRequest.flush({ ...apiGoal, contributions: [contribution] });
      expect((await added).contributions).toEqual([contribution]);

      const removed = firstValueFrom(repository.removeContribution(goal, 'c1'));
      http
        .expectOne({ url: `/api/v1/goals/${goal.id}/contributions/c1`, method: 'DELETE' })
        .flush(apiGoal);
      expect((await removed).contributions).toEqual([]);
    });

    it('never sends the contributions in an update', async () => {
      const updated = firstValueFrom(
        TestBed.inject(ApiGoalRepository).update(apiGoal.id, {
          name: 'Reserva de emergência',
          contributions: [],
          isPaused: true,
        }),
      );
      const request = http.expectOne({ url: `/api/v1/goals/${apiGoal.id}`, method: 'PATCH' });
      expect(request.request.body).toEqual({ name: 'Reserva de emergência', isPaused: true });
      request.flush(apiGoal);
      await updated;
    });
  });
});
