import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BudgetProgress } from '../../shared/models/budget';
import { IsoMonth } from '../../shared/utils/month';
import { BudgetProgressRepository } from '../repositories/budget-progress.repository';
import { API_BASE_URL } from './api.config';
import { SessionUser } from './api-http';
import { toBudgetModel } from './api-budget.repository';
import type { ApiBudget } from './api-types';

/** Consumo dos orçamentos calculado pela API (`GET /v1/budgets?month=`). */
@Injectable()
export class ApiBudgetProgressRepository extends BudgetProgressRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/budgets`;
  private readonly session = inject(SessionUser);

  listByMonth(_userId: string, month: IsoMonth): Observable<BudgetProgress[]> {
    return this.http.get<ApiBudget[]>(this.url, { params: { month } }).pipe(
      map((list) =>
        list.flatMap((item) =>
          // Sem vigência no mês, o orçamento não vale e vem sem consumo.
          item.progress
            ? [{ ...item.progress, budget: toBudgetModel(item, this.session.id()) }]
            : [],
        ),
      ),
    );
  }
}
