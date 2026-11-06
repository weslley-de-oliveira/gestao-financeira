import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';
import {
  TransactionFilters,
  TransactionPage,
  TransactionPageRequest,
  TransactionTotals,
} from '../../shared/models/transaction-query';

export type TransactionChanges = Partial<
  Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;

/** Contrato de acesso às transações: na API (`data-access/api`) ou no `localStorage` (demo). */
export abstract class TransactionRepository {
  abstract listByUser(userId: string): Observable<Transaction[]>;

  /** Uma página das transações do usuário que passam nos filtros, na ordenação pedida. */
  abstract query(userId: string, request: TransactionPageRequest): Observable<TransactionPage>;

  /** Quantidade e totais de todas as transações do usuário que passam nos filtros. */
  abstract summarize(userId: string, filters: TransactionFilters): Observable<TransactionTotals>;

  /** Retorna `null` quando a transação não existe. */
  abstract findById(id: string): Observable<Transaction | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(transaction: NewRecord<Transaction>): Observable<Transaction>;

  /** `version`: o `updatedAt` do registro quando o formulário o carregou (concorrência otimista). */
  abstract update(
    id: string,
    changes: TransactionChanges,
    version?: string,
  ): Observable<Transaction>;

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
