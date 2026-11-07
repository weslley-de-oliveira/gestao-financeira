import { Observable } from 'rxjs';
import { RefundInput } from '../../features/refunds/domain/refund-rules';
import { Transaction } from '../../shared/models/transaction';

/**
 * Estornos de despesas: na API (`/v1/transactions/:id/refunds`) ou, na demonstração e nos testes,
 * como transações `refund` gravadas pelo repositório de transações. O estorno é editado e excluído
 * como qualquer transação (`TransactionRepository`).
 */
export abstract class RefundRepository {
  /** Grava o estorno na conta ou no cartão da despesa, ligado a ela. */
  abstract create(
    userId: string,
    expense: Transaction,
    input: RefundInput,
  ): Observable<Transaction>;

  /** Estornos da despesa, dos mais antigos aos mais recentes. */
  abstract listByExpense(userId: string, expenseId: string): Observable<Transaction[]>;
}
