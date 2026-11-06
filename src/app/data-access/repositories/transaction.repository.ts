import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';

export type TransactionChanges = Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>;

/** Contrato de acesso às transações: na API (`data-access/api`) ou no `localStorage` (demo). */
export abstract class TransactionRepository {
  abstract listByUser(userId: string): Observable<Transaction[]>;

  /** Retorna `null` quando a transação não existe. */
  abstract findById(id: string): Observable<Transaction | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(transaction: NewRecord<Transaction>): Observable<Transaction>;

  abstract update(id: string, changes: TransactionChanges): Observable<Transaction>;

  abstract delete(id: string): Observable<void>;

  /**
   * Registra o pagamento de uma fatura (transação `invoice-payment` do cartão e do mês). Por
   * padrão, grava a transação como qualquer outra; a API tem uma operação própria, que calcula o
   * valor e a data no servidor.
   */
  payInvoice(payment: NewRecord<Transaction>): Observable<Transaction> {
    return this.create(payment);
  }

  /** Desfaz o pagamento de uma fatura. Por padrão, apaga a transação do pagamento. */
  undoInvoicePayment(payment: Transaction): Observable<void> {
    return this.delete(payment.id);
  }
}
