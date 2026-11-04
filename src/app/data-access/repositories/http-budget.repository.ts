import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Budget } from '../../shared/models/budget';
import { API_BASE_URL } from '../api/api.config';
import { BudgetDto, toBudget, toBudgetDto } from '../dto/budget.dto';
import { BudgetChanges, BudgetRepository } from './budget.repository';

@Injectable()
export class HttpBudgetRepository extends BudgetRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/budgets`;

  listByUser(userId: string): Observable<Budget[]> {
    return this.http
      .get<BudgetDto[]>(this.url, { params: { userId } })
      .pipe(map((budgets) => budgets.map(toBudget)));
  }

  findById(id: string): Observable<Budget | null> {
    return this.http.get<BudgetDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(toBudget),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  create(budget: Budget): Observable<Budget> {
    return this.http.post<BudgetDto>(this.url, toBudgetDto(budget)).pipe(map(toBudget));
  }

  update(id: string, changes: BudgetChanges): Observable<Budget> {
    return this.http
      .patch<BudgetDto>(`${this.url}/${encodeURIComponent(id)}`, changes)
      .pipe(map(toBudget));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }
}
