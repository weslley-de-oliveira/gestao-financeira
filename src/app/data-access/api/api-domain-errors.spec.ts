import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiProblemError } from '../../core/interceptors/api-problem-error';
import { problemDetailsInterceptor } from '../../core/interceptors/problem-details.interceptor';
import { InvalidBudgetInputError } from '../../features/budgets/domain/budget-rules';
import { InvalidCreditCardInputError } from '../../features/credit-cards/domain/credit-card-input';
import {
  InsufficientGoalBalanceError,
  InvalidGoalInputError,
} from '../../features/goals/domain/goal-rules';
import {
  InvoicePaymentError,
  PaidInvoiceError,
} from '../../features/invoices/domain/invoice-rules';
import {
  InstallmentNotEditableError,
  InvalidAnticipationCountError,
  NothingToAnticipateError,
  NothingToCancelError,
} from '../../features/installments/domain/installment-rules';
import {
  HasRefundsError,
  InvalidRefundInputError,
  NotRefundableError,
} from '../../features/refunds/domain/refund-rules';
import { InvalidTransactionInputError } from '../../features/transactions/domain/transaction-rules';
import { Goal } from '../../shared/models/goal';
import { Transaction } from '../../shared/models/transaction';
import { ApiBudgetRepository } from './api-budget.repository';
import { ApiCreditCardRepository } from './api-credit-card.repository';
import { ApiGoalRepository } from './api-goal.repository';
import { ApiInstallmentPurchaseRepository } from './api-installment-purchase.repository';
import { ApiRefundRepository } from './api-refund.repository';
import { SessionUser } from './api-http';
import { ApiTransactionRepository } from './api-transaction.repository';
import { API_BASE_URL } from './api.config';

const USER_ID = '0190f1a2-0000-7000-8000-000000000001';

const transaction: Transaction = {
  id: 't1',
  userId: USER_ID,
  type: 'expense',
  description: 'Mercado do mês',
  amount: 25_000,
  date: '2026-11-05',
  accountId: 'a1',
  creditCardId: null,
  invoiceMonth: null,
  destinationAccountId: null,
  categoryId: 'c1',
  status: 'completed',
  notes: null,
  createdAt: '2026-11-05T12:00:00.000Z',
};

const goal: Goal = {
  id: 'g1',
  userId: USER_ID,
  name: 'Reserva',
  description: null,
  targetAmount: 1_000_000,
  initialAmount: 0,
  contributions: [],
  deadline: null,
  color: '#2e7d32',
  icon: 'savings',
  isPaused: false,
  isArchived: false,
  createdAt: '2026-11-01T12:00:00.000Z',
};

describe('API refusals as domain errors', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailsInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: AuthService, useValue: { endSession: vi.fn() } },
        { provide: SessionUser, useValue: { id: () => USER_ID } },
        ApiTransactionRepository,
        ApiCreditCardRepository,
        ApiBudgetRepository,
        ApiGoalRepository,
        ApiRefundRepository,
        ApiInstallmentPurchaseRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** Answers the only pending request with a Problem Details body, like the API. */
  function refuse(status: 409 | 422, field?: string): void {
    const [request] = http.match(() => true);
    request.flush(
      {
        type: 'about:blank',
        title: 'Erro',
        status,
        detail: 'Motivo da recusa.',
        ...(field ? { errors: [{ field: `body.${field}`, message: 'Inválido.' }] } : {}),
      },
      { status, statusText: 'Erro' },
    );
  }

  it('marks the refused link of a transaction', async () => {
    const saved = firstValueFrom(
      TestBed.inject(ApiTransactionRepository).update('t1', { categoryId: 'c2' }),
    );
    refuse(422, 'categoryId');

    const error = await saved.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(InvalidTransactionInputError);
    expect(error).toMatchObject({ field: 'categoryId' });
  });

  it('turns the conflict of a paid invoice into PaidInvoiceError, on save and on delete', async () => {
    const repository = TestBed.inject(ApiTransactionRepository);
    const paidInvoice = () =>
      http
        .match(() => true)[0]
        .flush(
          {
            type: '/problems/paid-invoice',
            title: 'Conflito',
            status: 409,
            detail: 'A fatura já foi paga.',
          },
          { status: 409, statusText: 'Conflict' },
        );

    const saved = firstValueFrom(repository.update('t1', { amount: 1 }));
    paidInvoice();
    await expect(saved).rejects.toBeInstanceOf(PaidInvoiceError);

    const deleted = firstValueFrom(repository.delete('t1'));
    paidInvoice();
    await expect(deleted).rejects.toBeInstanceOf(PaidInvoiceError);
  });

  it('turns the conflict of an installment changed alone into InstallmentNotEditableError', async () => {
    const deleted = firstValueFrom(TestBed.inject(ApiTransactionRepository).delete('t1'));
    http
      .match(() => true)[0]
      .flush(
        { type: '/problems/installment', title: 'Conflito', status: 409, detail: 'É uma parcela.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(deleted).rejects.toBeInstanceOf(InstallmentNotEditableError);
  });

  it('turns the conflict of an expense with refunds into HasRefundsError', async () => {
    const deleted = firstValueFrom(TestBed.inject(ApiTransactionRepository).delete('t1'));
    http
      .match(() => true)[0]
      .flush(
        { type: '/problems/has-refunds', title: 'Conflito', status: 409, detail: 'Tem estornos.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(deleted).rejects.toBeInstanceOf(HasRefundsError);
  });

  it('refuses a refund of what is not a completed expense, in a paid invoice or too large', async () => {
    const repository = TestBed.inject(ApiRefundRepository);
    const input = { description: 'Estorno', amount: 1, date: '2026-11-05', notes: null };

    const notRefundable = firstValueFrom(repository.create(USER_ID, transaction, input));
    refuse(409);
    await expect(notRefundable).rejects.toBeInstanceOf(NotRefundableError);

    const paid = firstValueFrom(repository.create(USER_ID, transaction, input));
    http
      .match(() => true)[0]
      .flush(
        { type: '/problems/paid-invoice', title: 'Conflito', status: 409, detail: 'Paga.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(paid).rejects.toBeInstanceOf(PaidInvoiceError);

    const tooLarge = firstValueFrom(repository.create(USER_ID, transaction, input));
    refuse(422, 'amount');
    const error = await tooLarge.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(InvalidRefundInputError);
    expect(error).toMatchObject({ field: 'amount' });
  });

  it('keeps other transaction refusals as ApiProblemError, with the server reason', async () => {
    const saved = firstValueFrom(TestBed.inject(ApiTransactionRepository).update('t1', {}));
    refuse(409);

    await expect(saved).rejects.toBeInstanceOf(ApiProblemError);
  });

  it('refuses an invoice payment that changed since the page loaded', async () => {
    const paid = firstValueFrom(
      TestBed.inject(ApiTransactionRepository).payInvoice({
        ...transaction,
        type: 'invoice-payment',
        creditCardId: 'k1',
        invoiceMonth: '2026-11',
      }),
    );
    refuse(409);

    const error = await paid.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(InvoicePaymentError);
    expect(error).toMatchObject({ reason: 'not-payable' });
  });

  it('refuses anticipating or cancelling installments when there is nothing to do', async () => {
    const repository = TestBed.inject(ApiInstallmentPurchaseRepository);

    const anticipation = firstValueFrom(repository.anticipate(USER_ID, 'group', 1));
    refuse(409);
    await expect(anticipation).rejects.toBeInstanceOf(NothingToAnticipateError);

    const tooMany = firstValueFrom(repository.anticipate(USER_ID, 'group', 9));
    refuse(422, 'count');
    await expect(tooMany).rejects.toBeInstanceOf(InvalidAnticipationCountError);

    const cancellation = firstValueFrom(repository.cancel(USER_ID, 'group'));
    refuse(409);
    await expect(cancellation).rejects.toBeInstanceOf(NothingToCancelError);
  });

  it('marks an archived payment account of a card', async () => {
    const saved = firstValueFrom(
      TestBed.inject(ApiCreditCardRepository).update('k1', { paymentAccountId: 'a2' }),
    );
    refuse(409);

    await expect(saved).rejects.toBeInstanceOf(InvalidCreditCardInputError);
  });

  it('marks the category of a budget', async () => {
    const saved = firstValueFrom(
      TestBed.inject(ApiBudgetRepository).create({
        userId: USER_ID,
        categoryId: 'c1',
        limits: [{ month: '2026-11', amount: 50_000 }],
        alertThreshold: 80,
      }),
    );
    refuse(422, 'categoryId');

    await expect(saved).rejects.toBeInstanceOf(InvalidBudgetInputError);
  });

  it('refuses a withdrawal that leaves the goal negative and a contribution in the future', async () => {
    const repository = TestBed.inject(ApiGoalRepository);
    const contribution = { type: 'withdrawal' as const, amount: 1, date: '2026-11-05', note: null };

    const withdrawal = firstValueFrom(repository.addContribution(goal, contribution));
    refuse(409);
    await expect(withdrawal).rejects.toBeInstanceOf(InsufficientGoalBalanceError);

    const future = firstValueFrom(repository.addContribution(goal, contribution));
    refuse(422, 'date');
    const error = await future.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(InvalidGoalInputError);
    expect(error).toMatchObject({ field: 'date' });
  });
});
