import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Goal } from '../../shared/models/goal';
import { Transaction } from '../../shared/models/transaction';
import { ApiAccountRepository } from './api-account.repository';
import { ApiBudgetRepository } from './api-budget.repository';
import { ApiCategoryRepository } from './api-category.repository';
import { ApiGoalRepository } from './api-goal.repository';
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
    createdAt: '2026-11-05T12:00:00.000Z',
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
        ApiGoalRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('accounts', () => {
    it('lists archived accounts too and fills the owner from the session', async () => {
      const list = firstValueFrom(TestBed.inject(ApiAccountRepository).listByUser());
      http
        .expectOne({ url: '/api/v1/accounts?includeArchived=true', method: 'GET' })
        .flush([apiAccount]);

      const [account] = await list;
      expect(account.userId).toBe(USER_ID);
      expect(account).not.toHaveProperty('currentBalance');
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
        createdAt: '2026-11-01T12:00:00.000Z',
      });

      expect((await updated).isArchived).toBe(true);
    });
  });

  describe('transactions', () => {
    it('follows the cursor until the last page', async () => {
      const list = firstValueFrom(TestBed.inject(ApiTransactionRepository).listByUser());
      http
        .expectOne('/api/v1/transactions?limit=100')
        .flush({ items: [apiTransaction({ id: 'a' })], nextCursor: 'c1' });
      http
        .expectOne('/api/v1/transactions?limit=100&cursor=c1')
        .flush({ items: [apiTransaction({ id: 'b' })], nextCursor: null });

      expect((await list).map((item) => item.id)).toEqual(['a', 'b']);
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
