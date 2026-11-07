import { Observable } from 'rxjs';
import {
  InstallmentPurchase,
  InstallmentPurchaseChanges,
  InstallmentPurchaseInput,
} from '../../features/installments/domain/installment-rules';
import { Transaction } from '../../shared/models/transaction';

/**
 * Compras parceladas no cartão: na API (`/v1/installment-purchases`) ou, na demonstração e nos
 * testes, como compras comuns gravadas pelo repositório de transações.
 */
export abstract class InstallmentPurchaseRepository {
  /** Divide a compra em parcelas, uma por fatura, e grava todas. */
  abstract create(userId: string, input: InstallmentPurchaseInput): Observable<InstallmentPurchase>;

  /** Retorna `null` quando a compra não existe ou é de outro usuário. */
  abstract findById(userId: string, id: string): Observable<InstallmentPurchase | null>;

  /** Altera descrição, categoria e observações de todas as parcelas. */
  abstract update(
    userId: string,
    id: string,
    changes: InstallmentPurchaseChanges,
  ): Observable<InstallmentPurchase>;

  /** Exclui todas as parcelas. */
  abstract delete(userId: string, id: string): Observable<void>;

  /**
   * Leva as últimas `count` parcelas que podem ser antecipadas (`anticipatableCount`) para a fatura
   * atual: a data delas passa a ser hoje.
   */
  abstract anticipate(userId: string, id: string, count: number): Observable<InstallmentPurchase>;

  /**
   * Estorna o que falta das parcelas da fatura atual e das futuras (`cancellable`) e devolve os
   * estornos criados.
   */
  abstract cancel(userId: string, id: string): Observable<Transaction[]>;
}
