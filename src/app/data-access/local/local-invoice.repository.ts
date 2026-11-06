import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { TODAY } from '../../core/services/today';
import {
  Invoice,
  InvoiceSummary,
  buildInvoice,
  listInvoices,
  toInvoiceSummary,
} from '../../features/invoices/domain/invoice-rules';
import { CreditCard } from '../../shared/models/credit-card';
import { Transaction } from '../../shared/models/transaction';
import { toIsoDate } from '../../shared/utils/date';
import { CreditCardRepository } from '../repositories/credit-card.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { TransactionRepository } from '../repositories/transaction.repository';

/**
 * Faturas calculadas no navegador (demo e testes), a partir do cartão e das transações da pessoa,
 * com as mesmas regras do servidor.
 */
@Injectable()
export class LocalInvoiceRepository extends InvoiceRepository {
  private readonly creditCards = inject(CreditCardRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly today = inject(TODAY);

  listByCard(userId: string, creditCardId: string): Observable<InvoiceSummary[]> {
    return defer(async () => {
      const data = await this.load(userId, creditCardId);
      return data
        ? listInvoices(data.card, data.transactions, toIsoDate(this.today())).map(toInvoiceSummary)
        : [];
    });
  }

  findByMonth(
    userId: string,
    creditCardId: string,
    referenceMonth: string,
  ): Observable<Invoice | null> {
    return defer(async () => {
      const data = await this.load(userId, creditCardId);
      if (!data) {
        return null;
      }
      try {
        return buildInvoice(data.card, data.transactions, referenceMonth, toIsoDate(this.today()));
      } catch {
        // Mês de referência inválido.
        return null;
      }
    });
  }

  private async load(
    userId: string,
    creditCardId: string,
  ): Promise<{ card: CreditCard; transactions: Transaction[] } | null> {
    const [card, transactions] = await Promise.all([
      firstValueFrom(this.creditCards.findById(creditCardId)),
      firstValueFrom(this.transactions.listByUser(userId)),
    ]);
    return card && card.userId === userId ? { card, transactions } : null;
  }
}
