import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { CreditCard } from '../../shared/models/credit-card';

export type CreditCardChanges = Partial<Omit<CreditCard, 'id' | 'userId' | 'createdAt'>>;

/** Contrato de acesso aos cartões de crédito. A implementação atual usa HTTP (JSON Server). */
export abstract class CreditCardRepository {
  abstract listByUser(userId: string): Observable<CreditCard[]>;

  /** Retorna `null` quando o cartão não existe. */
  abstract findById(id: string): Observable<CreditCard | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(card: NewRecord<CreditCard>): Observable<CreditCard>;

  abstract update(id: string, changes: CreditCardChanges): Observable<CreditCard>;
}
