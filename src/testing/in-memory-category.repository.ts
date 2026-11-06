import { NewRecord, withIdentity } from '../app/data-access/repositories/new-record';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  CategoryChanges,
  CategoryRepository,
} from '../app/data-access/repositories/category.repository';
import { Category } from '../app/shared/models/category';

/** Repositório de categorias em memória, para testes sem API. */
@Injectable()
export class InMemoryCategoryRepository extends CategoryRepository {
  readonly records: Category[] = [];

  listByUser(userId: string): Observable<Category[]> {
    return of(this.records.filter((category) => category.userId === userId).map(clone));
  }

  findById(id: string): Observable<Category | null> {
    const category = this.records.find((record) => record.id === id);
    return of(category ? clone(category) : null);
  }

  create(input: NewRecord<Category>): Observable<Category> {
    const category = withIdentity<Category>(input);
    this.records.push(clone(category));
    return of(clone(category));
  }

  update(id: string, changes: CategoryChanges): Observable<Category> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Category ${id} not found`));
    }
    this.records[index] = { ...this.records[index], ...changes };
    return of(clone(this.records[index]));
  }
}

function clone(category: Category): Category {
  return { ...category };
}
