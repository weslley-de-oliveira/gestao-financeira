import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Category } from '../../shared/models/category';
import { CategoryChanges, CategoryRepository } from '../repositories/category.repository';
import { NewRecord } from '../repositories/new-record';
import { API_BASE_URL } from './api.config';
import { SessionUser, nullWhenNotFound, pick } from './api-http';
import type { ApiCategory } from './api-types';

/** Categorias na API real (`/v1/categories`). */
@Injectable()
export class ApiCategoryRepository extends CategoryRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/categories`;
  private readonly session = inject(SessionUser);

  /** O servidor devolve só as categorias da sessão; `userId` não é enviado. */
  listByUser(): Observable<Category[]> {
    return this.http
      .get<ApiCategory[]>(this.url, { params: { includeArchived: true } })
      .pipe(map((list) => list.map((item) => this.toCategory(item))));
  }

  findById(id: string): Observable<Category | null> {
    return this.http.get<ApiCategory>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map((item) => this.toCategory(item)),
      nullWhenNotFound(),
    );
  }

  /** `isDefault` e `isArchived` são definidos pelo servidor. */
  create(category: NewRecord<Category>): Observable<Category> {
    return this.http
      .post<ApiCategory>(this.url, pick(category, ['name', 'type', 'icon', 'color']))
      .pipe(map((item) => this.toCategory(item)));
  }

  update(id: string, changes: CategoryChanges): Observable<Category> {
    return this.http
      .patch<ApiCategory>(
        `${this.url}/${encodeURIComponent(id)}`,
        pick(changes, ['name', 'icon', 'color', 'isArchived']),
      )
      .pipe(map((item) => this.toCategory(item)));
  }

  private toCategory(item: ApiCategory): Category {
    return {
      id: item.id,
      userId: this.session.id(),
      name: item.name,
      type: item.type,
      icon: item.icon,
      color: item.color,
      isDefault: item.isDefault,
      isArchived: item.isArchived,
      createdAt: item.createdAt,
    };
  }
}
