import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { UserDataRepository } from '../app/data-access/repositories/user-data.repository';
import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryBudgetRepository } from './in-memory-budget.repository';
import { InMemoryCategoryRepository } from './in-memory-category.repository';
import { InMemoryCreditCardRepository } from './in-memory-credit-card.repository';
import { InMemoryGoalRepository } from './in-memory-goal.repository';
import { InMemoryTransactionRepository } from './in-memory-transaction.repository';
import { InMemoryUserRepository } from './in-memory-user.repository';

/** Apaga os dados do usuário dos repositórios em memória. */
@Injectable()
export class InMemoryUserDataRepository extends UserDataRepository {
  private readonly collections: { records: { userId: string }[] }[] = [
    inject(InMemoryTransactionRepository),
    inject(InMemoryBudgetRepository),
    inject(InMemoryGoalRepository),
    inject(InMemoryCreditCardRepository),
    inject(InMemoryCategoryRepository),
    inject(InMemoryAccountRepository),
  ];
  private readonly users = inject(InMemoryUserRepository);

  deleteAllForUser(userId: string): Observable<void> {
    for (const { records } of this.collections) {
      removeWhere(records, (record) => record.userId === userId);
    }
    removeWhere(this.users.records, (record) => record.user.id === userId);
    return of(undefined);
  }
}

function removeWhere<T>(records: T[], predicate: (record: T) => boolean): void {
  for (let index = records.length - 1; index >= 0; index--) {
    if (predicate(records[index])) {
      records.splice(index, 1);
    }
  }
}
