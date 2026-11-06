import { differenceInCalendarMonths } from 'date-fns';
import { APPEARANCE_COLORS, isAppearanceOption } from '../../../shared/models/appearance';
import {
  CONTRIBUTION_NOTE_MAX_LENGTH,
  ContributionType,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_ICONS,
  GOAL_NAME_MAX_LENGTH,
  Goal,
  GoalContribution,
  GoalStatus,
  GoalWithProgress,
} from '../../../shared/models/goal';
import { IsoDate, isIsoDate, parseIsoDate } from '../../../shared/utils/date';
import { Cents, MAX_MONEY_CENTS, isValidCents } from '../../../shared/utils/money';
import { collapseWhitespace } from '../../../shared/utils/text';

/** Dados editáveis de uma meta, com valores em centavos. */
export type GoalInput = Pick<
  Goal,
  'name' | 'description' | 'targetAmount' | 'initialAmount' | 'deadline' | 'color' | 'icon'
>;

export interface ContributionInput {
  type: ContributionType;
  amount: Cents;
  date: IsoDate;
  note: string | null;
}

export class InvalidGoalInputError extends Error {
  constructor(readonly field: keyof GoalInput | keyof ContributionInput) {
    super(`Invalid goal ${field}`);
    this.name = 'InvalidGoalInputError';
  }
}

/** A operação deixaria o valor acumulado negativo. */
export class InsufficientGoalBalanceError extends Error {
  constructor() {
    super('The goal balance would become negative');
    this.name = 'InsufficientGoalBalanceError';
  }
}

/** Inicial + aportes − retiradas. */
export function goalBalance(
  goal: Pick<Goal, 'initialAmount'> & {
    contributions: readonly Pick<GoalContribution, 'type' | 'amount'>[];
  },
): Cents {
  return goal.contributions.reduce(
    (total, item) => total + (item.type === 'deposit' ? item.amount : -item.amount),
    goal.initialAmount,
  );
}

/**
 * Status pela regra única: concluída quando o acumulado atinge o alvo; senão pausada (escolha da
 * pessoa); senão atrasada quando o prazo já passou; senão em andamento.
 */
export function goalStatus(
  goal: Pick<Goal, 'targetAmount' | 'deadline' | 'isPaused'>,
  currentAmount: Cents,
  today: IsoDate,
): GoalStatus {
  if (currentAmount >= goal.targetAmount) {
    return 'completed';
  }
  if (goal.isPaused) {
    return 'paused';
  }
  return goal.deadline && goal.deadline < today ? 'overdue' : 'in-progress';
}

/**
 * Progresso, valor restante, excedente (não é descartado) e ritmo: o aporte mensal necessário
 * divide o que falta pelos meses até o prazo, contando o mês atual, arredondado para cima.
 */
export function calculateGoalProgress(goal: Goal, today: IsoDate): GoalWithProgress {
  const currentAmount = goalBalance(goal);
  const status = goalStatus(goal, currentAmount, today);
  const remainingAmount = Math.max(0, goal.targetAmount - currentAmount);

  // Sem ritmo quando concluída, sem prazo ou com prazo vencido (inclusive se pausada).
  let monthsLeft: number | null = null;
  const deadline = goal.deadline && goal.deadline >= today ? parseIsoDate(goal.deadline) : null;
  const now = parseIsoDate(today);
  if (deadline && now && status !== 'completed') {
    monthsLeft = differenceInCalendarMonths(deadline, now) + 1;
  }

  return {
    ...goal,
    currentAmount,
    remainingAmount,
    excessAmount: Math.max(0, currentAmount - goal.targetAmount),
    percent: (currentAmount / goal.targetAmount) * 100,
    status,
    monthsLeft,
    monthlyPace: monthsLeft === null ? null : Math.ceil(remainingAmount / monthsLeft),
  };
}

/** Percentual para barras de progresso: limitado a 0–100, sem alterar o valor acumulado. */
export function goalProgressBarValue(goal: Pick<GoalWithProgress, 'percent'>): number {
  return Math.min(100, Math.max(0, Math.round(goal.percent)));
}

export function normalizeGoalInput(input: GoalInput): GoalInput {
  const name = collapseWhitespace(input.name);
  const description = input.description?.trim() || null;

  if (!name || name.length > GOAL_NAME_MAX_LENGTH) {
    throw new InvalidGoalInputError('name');
  }
  if (description && description.length > GOAL_DESCRIPTION_MAX_LENGTH) {
    throw new InvalidGoalInputError('description');
  }
  if (!isMoney(input.targetAmount) || input.targetAmount <= 0) {
    throw new InvalidGoalInputError('targetAmount');
  }
  if (!isMoney(input.initialAmount) || input.initialAmount < 0) {
    throw new InvalidGoalInputError('initialAmount');
  }
  if (input.deadline !== null && !isIsoDate(input.deadline)) {
    throw new InvalidGoalInputError('deadline');
  }
  if (!isAppearanceOption(APPEARANCE_COLORS, input.color)) {
    throw new InvalidGoalInputError('color');
  }
  if (!isAppearanceOption(GOAL_ICONS, input.icon)) {
    throw new InvalidGoalInputError('icon');
  }
  return { ...input, name, description };
}

/** Aporte ou retirada positivo, com data válida até hoje e observação opcional. */
export function normalizeContributionInput(
  input: ContributionInput,
  today: IsoDate,
): ContributionInput {
  const note = input.note?.trim() || null;
  if (input.type !== 'deposit' && input.type !== 'withdrawal') {
    throw new InvalidGoalInputError('type');
  }
  if (!isMoney(input.amount) || input.amount <= 0) {
    throw new InvalidGoalInputError('amount');
  }
  if (!isIsoDate(input.date) || input.date > today) {
    throw new InvalidGoalInputError('date');
  }
  if (note && note.length > CONTRIBUTION_NOTE_MAX_LENGTH) {
    throw new InvalidGoalInputError('note');
  }
  return { ...input, note };
}

function isMoney(value: number): boolean {
  return isValidCents(value) && Math.abs(value) <= MAX_MONEY_CENTS;
}
