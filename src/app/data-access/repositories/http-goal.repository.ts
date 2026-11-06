import { NewRecord, withIdentity } from './new-record';
import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Goal } from '../../shared/models/goal';
import { API_BASE_URL } from '../api/api.config';
import { GoalDto, toGoal, toGoalDto } from '../dto/goal.dto';
import { GoalChanges, GoalRepository } from './goal.repository';

@Injectable()
export class HttpGoalRepository extends GoalRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/goals`;

  listByUser(userId: string): Observable<Goal[]> {
    return this.http
      .get<GoalDto[]>(this.url, { params: { userId } })
      .pipe(map((goals) => goals.map(toGoal)));
  }

  findById(id: string): Observable<Goal | null> {
    return this.http.get<GoalDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(
      map(toGoal),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  create(input: NewRecord<Goal>): Observable<Goal> {
    const goal = withIdentity<Goal>(input);
    return this.http.post<GoalDto>(this.url, toGoalDto(goal)).pipe(map(toGoal));
  }

  update(id: string, changes: GoalChanges): Observable<Goal> {
    return this.http
      .patch<GoalDto>(`${this.url}/${encodeURIComponent(id)}`, changes)
      .pipe(map(toGoal));
  }
}
