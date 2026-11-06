import { NewRecord, withIdentity } from '../app/data-access/repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  CategoryChanges,
  CategoryRepository,
} from '../app/data-access/repositories/category.repository';
import { Category, withTransactionCounts } from '../app/shared/models/category';
import { InMemoryTransactionRepository } from './in-memory-transaction.repository';

/**
 * Repositório de categorias em memória, para testes sem API. Conta as transações de cada
 * categoria no repositório de transações em memória, como a API faz.
 */
@Injectable()
export class InMemoryCategoryRepository extends CategoryRepository {
  private readonly transactions = inject(InMemoryTransactionRepository, { optional: true });
  readonly records: Category[] = [];

  listByUser(userId: string): Observable<Category[]> {
    return of(this.withCounts(this.records.filter((category) => category.userId === userId)));
  }

  findById(id: string): Observable<Category | null> {
    const category = this.records.find((record) => record.id === id);
    return of(category ? this.withCounts([category])[0] : null);
  }

  create(input: NewRecord<Category>): Observable<Category> {
    const category = withIdentity<Category>(input);
    this.records.push(clone(category));
    return of({ ...clone(category), transactionCount: 0 });
  }

  update(id: string, changes: CategoryChanges): Observable<Category> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Category ${id} not found`));
    }
    this.records[index] = { ...this.records[index], ...changes };
    return of(this.withCounts([this.records[index]])[0]);
  }

  private withCounts(categories: readonly Category[]): Category[] {
    return withTransactionCounts(categories, this.transactions?.records ?? []);
  }
}

function clone(category: Category): Category {
  return { ...category };
}
