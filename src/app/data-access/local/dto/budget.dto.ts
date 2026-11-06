import { Budget } from '../../../shared/models/budget';

/** Registro de `budgets` no `localStorage` da demo (e no seed). Limites em centavos, meses `yyyy-MM`. */
export interface BudgetDto {
  id: string;
  userId: string;
  categoryId: string;
  limits: { month: string; amount: number }[];
  alertThreshold: number;
  createdAt: string;
}

export function toBudget(dto: BudgetDto): Budget {
  return {
    id: dto.id,
    userId: dto.userId,
    categoryId: dto.categoryId,
    limits: [...(dto.limits ?? [])]
      .map((limit) => ({ month: limit.month, amount: limit.amount }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    alertThreshold: dto.alertThreshold,
    createdAt: dto.createdAt,
  };
}

export function toBudgetDto(budget: Budget): BudgetDto {
  return { ...budget, limits: budget.limits.map((limit) => ({ ...limit })) };
}
