import { NewRecord, withIdentity } from '../repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom, map } from 'rxjs';
import { Category, withTransactionCounts } from '../../shared/models/category';
import { toCategory, toCategoryDto } from './dto/category.dto';
import { CategoryChanges, CategoryRepository } from '../repositories/category.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/**
 * Categorias da demonstração, no `localStorage`. A quantidade de transações de cada categoria é
 * contada na leitura, como a API faz.
 */
@Injectable()
export class LocalCategoryRepository extends CategoryRepository {
  private readonly database = inject(LocalDatabase);
  private readonly categories = new LocalCollection(this.database, 'categories');
  private readonly transactions = new LocalCollection(this.database, 'transactions');

  listByUser(userId: string): Observable<Category[]> {
    return this.withCounts(
      this.categories.listByUser(userId).pipe(map((records) => records.map(toCategory))),
    );
  }

  findById(id: string): Observable<Category | null> {
    return defer(async () => {
      const dto = await firstValueFrom(this.categories.findById(id));
      if (!dto) {
        return null;
      }
      const [category] = await firstValueFrom(
        this.withCounts(defer(async () => [toCategory(dto)])),
      );
      return category;
    });
  }

  create(input: NewRecord<Category>): Observable<Category> {
    const category = withIdentity<Category>(input);
    return this.categories
      .insert(toCategoryDto(category))
      .pipe(map((dto) => ({ ...toCategory(dto), transactionCount: 0 })));
  }

  update(id: string, changes: CategoryChanges): Observable<Category> {
    return this.withCounts(
      this.categories.patch(id, changes).pipe(map((dto) => [toCategory(dto)])),
    ).pipe(map(([category]) => category));
  }

  private withCounts(source: Observable<Category[]>): Observable<Category[]> {
    return defer(async () => {
      const categories = await firstValueFrom(source);
      const userId = categories[0]?.userId;
      const transactions = userId ? await firstValueFrom(this.transactions.listByUser(userId)) : [];
      return withTransactionCounts(categories, transactions);
    });
  }
}
