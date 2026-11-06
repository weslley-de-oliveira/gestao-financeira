import { NewRecord, withIdentity } from '../repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Category } from '../../shared/models/category';
import { toCategory, toCategoryDto } from '../dto/category.dto';
import { CategoryChanges, CategoryRepository } from '../repositories/category.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/** Categorias da demonstração, no `localStorage`. */
@Injectable()
export class LocalCategoryRepository extends CategoryRepository {
  private readonly categories = new LocalCollection(inject(LocalDatabase), 'categories');

  listByUser(userId: string): Observable<Category[]> {
    return this.categories.listByUser(userId).pipe(map((records) => records.map(toCategory)));
  }

  findById(id: string): Observable<Category | null> {
    return this.categories.findById(id).pipe(map((dto) => (dto ? toCategory(dto) : null)));
  }

  create(input: NewRecord<Category>): Observable<Category> {
    const category = withIdentity<Category>(input);
    return this.categories.insert(toCategoryDto(category)).pipe(map(toCategory));
  }

  update(id: string, changes: CategoryChanges): Observable<Category> {
    return this.categories.patch(id, changes).pipe(map(toCategory));
  }
}
