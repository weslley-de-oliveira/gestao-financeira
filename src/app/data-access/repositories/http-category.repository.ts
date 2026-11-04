import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Category } from '../../shared/models/category';
import { API_BASE_URL } from '../api/api.config';
import { CategoryDto, toCategory, toCategoryDto } from '../dto/category.dto';
import { CategoryChanges, CategoryRepository } from './category.repository';

@Injectable()
export class HttpCategoryRepository extends CategoryRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/categories`;

  listByUser(userId: string): Observable<Category[]> {
    return this.http
      .get<CategoryDto[]>(this.url, { params: { userId } })
      .pipe(map((categories) => categories.map(toCategory)));
  }

  findById(id: string): Observable<Category | null> {
    return this.http.get<CategoryDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(toCategory),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  create(category: Category): Observable<Category> {
    return this.http.post<CategoryDto>(this.url, toCategoryDto(category)).pipe(map(toCategory));
  }

  update(id: string, changes: CategoryChanges): Observable<Category> {
    return this.http
      .patch<CategoryDto>(`${this.url}/${encodeURIComponent(id)}`, changes)
      .pipe(map(toCategory));
  }
}
