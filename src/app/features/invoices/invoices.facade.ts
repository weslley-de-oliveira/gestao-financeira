import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { TODAY } from '../../core/services/today';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { CreditCard } from '../../shared/models/credit-card';
import { Transaction } from '../../shared/models/transaction';
import { toIsoDate } from '../../shared/utils/date';
import { TransactionsFacade } from '../transactions/transactions.facade';
import { Invoice, buildInvoice, canPayInvoice } from './domain/invoice-rules';

/**
 * Motivo da recusa: fatura inexistente, que não pode ser paga (aberta, sem compras ou já paga),
 * ou conta de pagamento do cartão indisponível (arquivada ou removida).
 */
export type InvoicePaymentFailure = 'not-found' | 'not-payable' | 'payment-account';

export class InvoicePaymentError extends Error {
  constructor(readonly reason: InvoicePaymentFailure) {
    super(`Invoice payment refused: ${reason}`);
    this.name = 'InvoicePaymentError';
  }
}

/**
 * Pagamento demonstrativo das faturas. A fatura é calculada a partir das transações; pagar cria
 * a transação `invoice-payment` (valor total, data de hoje, conta de pagamento do cartão) e
 * desfazer a exclui. A listagem usa as transações já carregadas na `TransactionsFacade`.
 */
@Injectable({ providedIn: 'root' })
export class InvoicesFacade {
  private readonly creditCards = inject(CreditCardRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly transactionsFacade = inject(TransactionsFacade);
  private readonly auth = inject(AuthService);
  private readonly today = inject(TODAY);

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
      amount: invoice.total,
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
    await this.transactionsFacade.load();
    return created;
  }

  /** Exclui o pagamento: o valor volta para a conta e a fatura volta ao status pelas datas. */
  async undoPayment(creditCardId: string, referenceMonth: string): Promise<void> {
    const { invoice } = await this.loadInvoice(creditCardId, referenceMonth);
    if (!invoice.payment) {
      throw new InvoicePaymentError('not-payable');
    }
    await firstValueFrom(this.transactions.undoInvoicePayment(invoice.payment));
    await this.transactionsFacade.load();
  }

  /** Recalcula a fatura com os dados atuais, garantindo que o cartão é do usuário. */
  private async loadInvoice(
    creditCardId: string,
    referenceMonth: string,
  ): Promise<{ card: CreditCard; invoice: Invoice }> {
    const userId = this.userId();
    const [card, transactions] = await Promise.all([
      firstValueFrom(this.creditCards.findById(creditCardId)),
      firstValueFrom(this.transactions.listByUser(userId)),
    ]);
    if (!card || card.userId !== userId) {
      throw new InvoicePaymentError('not-found');
    }
    try {
      const today = toIsoDate(this.today());
      return { card, invoice: buildInvoice(card, transactions, referenceMonth, today) };
    } catch {
      throw new InvoicePaymentError('not-found');
    }
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
