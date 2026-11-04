import { ContributionType, Goal } from '../../shared/models/goal';

/** Formato do recurso `goals` na API. Valores em centavos inteiros e datas `yyyy-MM-dd`. */
export interface GoalDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetAmount: number;
  initialAmount: number;
  contributions: {
    id: string;
    type: ContributionType;
    amount: number;
    date: string;
    note: string | null;
    createdAt: string;
  }[];
  deadline: string | null;
  color: string;
  icon: string;
  isPaused: boolean;
  isArchived: boolean;
  createdAt: string;
}

export function toGoal(dto: GoalDto): Goal {
  return {
    id: dto.id,
    userId: dto.userId,
    name: dto.name,
    description: dto.description ?? null,
    targetAmount: dto.targetAmount,
    initialAmount: dto.initialAmount ?? 0,
    contributions: (dto.contributions ?? []).map((item) => ({
      ...item,
      note: item.note ?? null,
    })),
    deadline: dto.deadline ?? null,
    color: dto.color,
    icon: dto.icon,
    isPaused: dto.isPaused ?? false,
    isArchived: dto.isArchived ?? false,
    createdAt: dto.createdAt,
  };
}

export function toGoalDto(goal: Goal): GoalDto {
  return { ...goal, contributions: goal.contributions.map((item) => ({ ...item })) };
}
