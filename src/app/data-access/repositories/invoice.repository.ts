import { Observable } from 'rxjs';
import { Invoice, InvoiceSummary } from '../../features/invoices/domain/invoice-rules';

/**
 * Faturas dos cartões, calculadas a partir das compras e pagamentos: na API, pelo servidor; na
 * demonstração e nos testes, pelas regras de `invoice-rules` sobre as transações locais.
 */
export abstract class InvoiceRepository {
  /**
   * Faturas do cartão, da mais recente para a mais antiga: a aberta hoje e todas as que têm
   * compras ou pagamento. Lista vazia se o cartão não for do usuário.
   */
  abstract listByCard(userId: string, creditCardId: string): Observable<InvoiceSummary[]>;

  /** Fatura do mês de referência, com as compras; `null` se o cartão não for do usuário. */
  abstract findByMonth(
    userId: string,
    creditCardId: string,
    referenceMonth: string,
  ): Observable<Invoice | null>;
}
