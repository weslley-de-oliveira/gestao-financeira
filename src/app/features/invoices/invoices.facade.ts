import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, PendingTasks, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { TODAY } from '../../core/services/today';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { InvoiceRepository } from '../../data-access/repositories/invoice.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { CreditCard } from '../../shared/models/credit-card';
import { Transaction } from '../../shared/models/transaction';
import { toIsoDate } from '../../shared/utils/date';
import {
  Invoice,
  InvoicePaymentError,
  InvoiceSummary,
  canPayInvoice,
} from './domain/invoice-rules';

export { InvoicePaymentError, type InvoicePaymentFailure } from './domain/invoice-rules';

export type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Faturas de um cartão e pagamento demonstrativo. As faturas vêm calculadas do repositório (na
 * API, pelo servidor); pagar cria a transação `invoice-payment` (valor total, data de hoje, conta
 * de pagamento do cartão) e desfazer a exclui.
 */
@Injectable({ providedIn: 'root' })
export class InvoicesFacade {
  private readonly invoicesRepository = inject(InvoiceRepository);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly auth = inject(AuthService);
  private readonly today = inject(TODAY);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly _invoices = signal<InvoiceSummary[]>([]);
  private readonly _invoice = signal<Invoice | null>(null);
  private readonly _status = signal<LoadStatus>('loading');
  private selection: { creditCardId: string; month: string | undefined } | null = null;
  /** Só a resposta do pedido mais recente vale (trocas rápidas de cartão ou mês). */
  private latest = 0;

  /** Faturas do cartão selecionado, da mais recente para a mais antiga. */
  readonly invoices = this._invoices.asReadonly();
  /** Fatura selecionada, com as compras. */
  readonly invoice = this._invoice.asReadonly();
  readonly status = this._status.asReadonly();

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this.latest++;
      this.selection = null;
      this._invoices.set([]);
      this._invoice.set(null);
      this._status.set('loading');
    });
  }

  /**
   * Carrega as faturas do cartão e a do mês pedido; sem mês (ou com um mês sem fatura), a aberta
   * hoje ou a mais recente.
   */
  async select(creditCardId: string, month?: string): Promise<void> {
    this.selection = { creditCardId, month };
    const done = this.pendingTasks.add();
    const request = ++this.latest;
    try {
      const userId = this.userId();
      const invoices = await firstValueFrom(
        this.invoicesRepository.listByCard(userId, creditCardId),
      );
      const chosen =
        invoices.find((invoice) => invoice.referenceMonth === month) ??
        invoices.find((invoice) => invoice.status === 'open') ??
        invoices[0];
      const invoice = chosen
        ? await firstValueFrom(
            this.invoicesRepository.findByMonth(userId, creditCardId, chosen.referenceMonth),
          )
        : null;
      if (request === this.latest) {
        this._invoices.set(invoices);
        this._invoice.set(invoice);
        this._status.set('ready');
      }
    } catch {
      if (request === this.latest) {
        this._status.set('error');
      }
    } finally {
      done();
    }
  }

  /** Recarrega a seleção atual (depois de pagar ou desfazer, ou numa nova tentativa). */
  async refresh(): Promise<void> {
    if (this.selection) {
      await this.select(this.selection.creditCardId, this.selection.month);
    }
  }

  async pay(creditCardId: string, referenceMonth: string): Promise<Transaction> {
    const { card, invoice } = await this.loadInvoice(creditCardId, referenceMonth);
    if (!canPayInvoice(invoice)) {
      throw new InvoicePaymentError('not-payable');
    }
    const accounts = await firstValueFrom(this.accounts.listByUser(this.userId()));
    const account = accounts.find((item) => item.id === card.paymentAccountId);
    if (!account || account.isArchived) {
      throw new InvoicePaymentError('payment-account');
    }

    const payment: NewRecord<Transaction> = {
      userId: this.userId(),
      type: 'invoice-payment',
      description: `Fatura ${card.name} ${monthLabel(referenceMonth)}`,
      amount: invoice.balance,
      date: toIsoDate(this.today()),
      accountId: account.id,
      creditCardId: card.id,
      invoiceMonth: referenceMonth,
      destinationAccountId: null,
      categoryId: null,
      status: 'completed',
      notes: null,
    };
    const created = await firstValueFrom(this.transactions.payInvoice(payment));
    await this.refresh();
    return created;
  }

  /** Exclui o pagamento: o valor volta para a conta e a fatura volta ao status pelas datas. */
  async undoPayment(creditCardId: string, referenceMonth: string): Promise<void> {
    const { invoice } = await this.loadInvoice(creditCardId, referenceMonth);
    if (!invoice.payment) {
      throw new InvoicePaymentError('not-payable');
    }
    await firstValueFrom(this.transactions.undoInvoicePayment(invoice.payment));
    await this.refresh();
  }

  /** A fatura com os dados atuais, garantindo que o cartão é do usuário. */
  private async loadInvoice(
    creditCardId: string,
    referenceMonth: string,
  ): Promise<{ card: CreditCard; invoice: Invoice }> {
    const userId = this.userId();
    const [card, invoice] = await Promise.all([
      firstValueFrom(this.creditCards.findById(creditCardId)),
      firstValueFrom(this.invoicesRepository.findByMonth(userId, creditCardId, referenceMonth)),
    ]);
    if (!card || card.userId !== userId || !invoice) {
      throw new InvoicePaymentError('not-found');
    }
    return { card, invoice };
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}

/** "2026-12" → "12/2026". */
export function monthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  return `${month}/${year}`;
}
