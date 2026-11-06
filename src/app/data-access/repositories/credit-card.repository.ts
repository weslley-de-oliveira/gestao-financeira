import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { CreditCard } from '../../shared/models/credit-card';

export type CreditCardChanges = Partial<
  Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;

/**
 * Contrato de acesso aos cartões de crédito: na API (`data-access/api`) ou no `localStorage`
 * (demo).
 */
export abstract class CreditCardRepository {
  abstract listByUser(userId: string): Observable<CreditCard[]>;

  /** Retorna `null` quando o cartão não existe. */
  abstract findById(id: string): Observable<CreditCard | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(card: NewRecord<CreditCard>): Observable<CreditCard>;

  /** `version`: o `updatedAt` do registro quando o formulário o carregou (concorrência otimista). */
  abstract update(id: string, changes: CreditCardChanges, version?: string): Observable<CreditCard>;
}
