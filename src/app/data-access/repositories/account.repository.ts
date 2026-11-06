import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { Account } from '../../shared/models/account';

export type AccountChanges = Partial<Omit<Account, 'id' | 'userId' | 'createdAt'>>;

/** Contrato de acesso às contas. A implementação atual usa HTTP (JSON Server). */
export abstract class AccountRepository {
  abstract listByUser(userId: string): Observable<Account[]>;

  /** Retorna `null` quando a conta não existe. */
  abstract findById(id: string): Observable<Account | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(account: NewRecord<Account>): Observable<Account>;

  abstract update(id: string, changes: AccountChanges): Observable<Account>;
}
