import type { ApiProblemDetails } from '../../data-access/api/api-types';

/** Campo recusado pela API, sem o prefixo da origem (`body.amount` → `amount`). */
export interface ApiProblemField {
  field: string;
  message: string;
}

/**
 * Recusa da API em Problem Details (RFC 9457): conflito (409) ou dados inválidos (422). Os
 * repositórios convertem os casos conhecidos nos erros de domínio que as telas já exibem.
 */
export class ApiProblemError extends Error {
  readonly status: number;
  readonly title: string;
  readonly fields: readonly ApiProblemField[];

  constructor(problem: Pick<ApiProblemDetails, 'status' | 'title' | 'detail' | 'errors'>) {
    super(problem.detail);
    this.name = 'ApiProblemError';
    this.status = problem.status;
    this.title = problem.title;
    this.fields = (problem.errors ?? []).map(({ field, message }) => ({
      field: field.replace(/^(body|params|query)\./, ''),
      message,
    }));
  }

  /** Primeiro campo recusado, se a recusa for de um campo. */
  get field(): string | null {
    return this.fields[0]?.field ?? null;
  }
}

/** O corpo tem o formato de Problem Details. */
export function isProblemDetails(body: unknown): body is ApiProblemDetails {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Partial<ApiProblemDetails>).status === 'number' &&
    typeof (body as Partial<ApiProblemDetails>).detail === 'string'
  );
}
