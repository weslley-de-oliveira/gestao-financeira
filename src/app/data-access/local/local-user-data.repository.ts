import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { UserDataRepository } from '../repositories/user-data.repository';
import { LocalDatabase } from './local-database';

const USER_COLLECTIONS = [
  'transactions',
  'budgets',
  'goals',
  'creditCards',
  'categories',
  'accounts',
] as const;

/** Apaga o usuário da demonstração e todos os dados dele do `localStorage`. */
@Injectable()
export class LocalUserDataRepository extends UserDataRepository {
  private readonly database = inject(LocalDatabase);

  deleteAllForUser(userId: string): Observable<void> {
    return defer(async () => {
      for (const collection of USER_COLLECTIONS) {
        await this.database.mutate(collection, (records) => removeWhere(records, userId));
      }
      await this.database.mutate('users', (users) => {
        const index = users.findIndex((user) => user.id === userId);
        if (index >= 0) {
          users.splice(index, 1);
        }
      });
    });
  }
}

function removeWhere(records: { userId: string }[], userId: string): void {
  for (let index = records.length - 1; index >= 0; index--) {
    if (records[index].userId === userId) {
      records.splice(index, 1);
    }
  }
}
