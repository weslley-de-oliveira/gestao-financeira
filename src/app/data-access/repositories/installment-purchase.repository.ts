import { Observable } from 'rxjs';
import {
  InstallmentPurchase,
  InstallmentPurchaseChanges,
  InstallmentPurchaseInput,
} from '../../features/installments/domain/installment-rules';

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
}
