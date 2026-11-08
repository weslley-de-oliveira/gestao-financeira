import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiProblemError } from '../../core/interceptors/api-problem-error';
import {
  InsufficientGoalBalanceError,
  InvalidGoalInputError,
} from '../../features/goals/domain/goal-rules';
import { Goal, GoalContribution } from '../../shared/models/goal';
import { GoalChanges, GoalRepository } from '../repositories/goal.repository';
import { NewRecord } from '../repositories/new-record';
import { API_BASE_URL } from './api.config';
import { ifMatch, nullWhenNotFound, pick, SessionUser, toDomainError } from './api-http';
import type { ApiGoal } from './api-types';

const FIELDS = [
  'name',
  'description',
  'targetAmount',
  'initialAmount',
  'deadline',
  'color',
  'icon',
] as const;

/**
 * Metas na API real (`/v1/goals`). Aportes e retiradas têm rotas próprias, e o servidor confere
 * que o acumulado não fica negativo.
 */
@Injectable()
export class ApiGoalRepository extends GoalRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/goals`;
  private readonly session = inject(SessionUser);

  /** O servidor devolve só as metas da sessão; `userId` não é enviado. */
  listByUser(): Observable<Goal[]> {
    return this.http
      .get<ApiGoal[]>(this.url, { params: { includeArchived: true } })
      .pipe(map((list) => list.map((item) => this.toGoal(item))));
  }

  findById(id: string): Observable<Goal | null> {
    return this.http.get<ApiGoal>(this.goalUrl(id)).pipe(
      map((item) => this.toGoal(item)),
      nullWhenNotFound(),
    );
  }

  /** Uma meta nova começa sem movimentações, ativa e não pausada. */
  create(goal: NewRecord<Goal>): Observable<Goal> {
    return this.http.post<ApiGoal>(this.url, pick(goal, FIELDS)).pipe(
      map((item) => this.toGoal(item)),
      toDomainError(goalProblem),
    );
  }

  update(id: string, changes: GoalChanges, version?: string): Observable<Goal> {
    return this.http
      .patch<ApiGoal>(
        this.goalUrl(id),
        pick(changes, [...FIELDS, 'isPaused', 'isArchived']),
        ifMatch(version),
      )
      .pipe(
        map((item) => this.toGoal(item)),
        toDomainError(goalProblem),
      );
  }

  override addContribution(
    goal: Goal,
    contribution: NewRecord<GoalContribution>,
  ): Observable<Goal> {
    return this.http
      .post<ApiGoal>(
        `${this.goalUrl(goal.id)}/contributions`,
        pick(contribution, ['type', 'amount', 'accountId', 'date', 'note']),
      )
      .pipe(
        map((item) => this.toGoal(item)),
        toDomainError(goalProblem),
      );
  }

  override removeContribution(goal: Goal, contributionId: string): Observable<Goal> {
    return this.http
      .delete<ApiGoal>(
        `${this.goalUrl(goal.id)}/contributions/${encodeURIComponent(contributionId)}`,
      )
      .pipe(
        map((item) => this.toGoal(item)),
        toDomainError(goalProblem),
      );
  }

  private goalUrl(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }

  private toGoal(item: ApiGoal): Goal {
    return toGoalModel(item, this.session.id());
  }
}

/** Tipo do 409 de uma conta arquivada (a movimentação não pode usá-la). */
const ARCHIVED_REFERENCE_PROBLEM = '/problems/archived-reference';

/**
 * Conta inexistente (422) ou arquivada (409), acumulado que ficaria negativo (409), prazo no
 * passado ou movimentação com data futura (422): os mesmos erros das regras locais.
 */
function goalProblem(problem: ApiProblemError): Error | null {
  if (problem.status === 409 && problem.type === ARCHIVED_REFERENCE_PROBLEM) {
    return new InvalidGoalInputError('accountId');
  }
  if (problem.status === 409) {
    return new InsufficientGoalBalanceError();
  }
  return problem.field === 'deadline' || problem.field === 'date' || problem.field === 'accountId'
    ? new InvalidGoalInputError(problem.field)
    : null;
}

/** Converte o formato da API no modelo do app; o dono é o usuário da sessão. */
export function toGoalModel(item: ApiGoal, userId: string): Goal {
  return {
    id: item.id,
    userId,
    name: item.name,
    description: item.description,
    targetAmount: item.targetAmount,
    initialAmount: item.initialAmount,
    contributions: item.contributions.map(
      ({ id, type, accountId, amount, date, note, createdAt }) => ({
        id,
        type,
        accountId,
        amount,
        date,
        note,
        createdAt,
      }),
    ),
    deadline: item.deadline,
    color: item.color,
    icon: item.icon,
    isPaused: item.isPaused,
    isArchived: item.isArchived,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
