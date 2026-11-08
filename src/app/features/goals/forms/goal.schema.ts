import { maxLength, required, schema, validate } from '@angular/forms/signals';
import { APPEARANCE_COLORS } from '../../../shared/models/appearance';
import {
  CONTRIBUTION_NOTE_MAX_LENGTH,
  ContributionType,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_NAME_MAX_LENGTH,
  Goal,
} from '../../../shared/models/goal';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { MAX_MONEY_CENTS, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { ContributionInput, GoalInput } from '../domain/goal-rules';

/** Modelo do formulário: valores como texto mascarado e prazo como `Date` do datepicker. */
export interface GoalFormModel {
  name: string;
  description: string;
  targetAmount: string;
  initialAmount: string;
  deadline: Date | null;
  color: string;
  icon: string;
}

export const emptyGoalForm = (): GoalFormModel => ({
  name: '',
  description: '',
  targetAmount: '',
  initialAmount: '0,00',
  deadline: null,
  color: APPEARANCE_COLORS[1].value,
  icon: 'savings',
});

export function toGoalFormModel(goal: Goal): GoalFormModel {
  return {
    name: goal.name,
    description: goal.description ?? '',
    targetAmount: formatMoneyInput(goal.targetAmount),
    initialAmount: formatMoneyInput(goal.initialAmount),
    deadline: goal.deadline ? parseIsoDate(goal.deadline) : null,
    color: goal.color,
    icon: goal.icon,
  };
}

/** Só deve ser chamado com o formulário válido. */
export function toGoalInput(model: GoalFormModel): GoalInput {
  const targetAmount = parseMoney(model.targetAmount);
  const initialAmount = parseMoney(model.initialAmount);
  if (targetAmount === null || initialAmount === null) {
    throw new RangeError('Invalid goal form');
  }
  return {
    name: model.name,
    description: model.description || null,
    targetAmount,
    initialAmount,
    deadline: model.deadline ? toIsoDate(model.deadline) : null,
    color: model.color,
    icon: model.icon,
  };
}

/** Valida um valor monetário digitado; `allowZero` aceita R$ 0,00 (valor inicial). */
function moneyError(text: string, allowZero: boolean) {
  if (!text) {
    return undefined;
  }
  const cents = parseMoney(text);
  if (cents === null || cents < 0 || (!allowZero && cents === 0)) {
    return {
      kind: 'money',
      message: allowZero ? 'Informe um valor válido.' : 'O valor deve ser maior que zero.',
    };
  }
  return cents > MAX_MONEY_CENTS
    ? { kind: 'moneyRange', message: 'O valor deve ser de até R$ 1 bilhão.' }
    : undefined;
}

export const goalSchema = schema<GoalFormModel>((p) => {
  required(p.name, { message: 'Informe o nome da meta.' });
  validate(p.name, ({ value }) =>
    value() && !value().trim() ? { kind: 'blank', message: 'Informe o nome da meta.' } : undefined,
  );
  maxLength(p.name, GOAL_NAME_MAX_LENGTH, {
    message: `O nome deve ter no máximo ${GOAL_NAME_MAX_LENGTH} caracteres.`,
  });

  required(p.targetAmount, { message: 'Informe o valor-alvo.' });
  validate(p.targetAmount, ({ value }) => moneyError(value(), false));

  required(p.initialAmount, { message: 'Informe o valor inicial (pode ser zero).' });
  validate(p.initialAmount, ({ value }) => moneyError(value(), true));

  maxLength(p.description, GOAL_DESCRIPTION_MAX_LENGTH, {
    message: `A descrição deve ter no máximo ${GOAL_DESCRIPTION_MAX_LENGTH} caracteres.`,
  });
});

export interface ContributionFormModel {
  type: ContributionType;
  amount: string;
  date: Date | null;
  note: string;
}

export const emptyContributionForm = (today: Date): ContributionFormModel => ({
  type: 'deposit',
  amount: '',
  date: today,
  note: '',
});

/** Só deve ser chamado com o formulário válido. */
export function toContributionInput(model: ContributionFormModel): ContributionInput {
  const amount = parseMoney(model.amount);
  if (amount === null || !model.date) {
    throw new RangeError('Invalid contribution form');
  }
  return {
    type: model.type,
    amount,
    accountId: null,
    date: toIsoDate(model.date),
    note: model.note || null,
  };
}

export const contributionSchema = schema<ContributionFormModel>((p) => {
  required(p.amount, { message: 'Informe o valor.' });
  validate(p.amount, ({ value }) => moneyError(value(), false));
  required(p.date, { message: 'Informe a data.' });
  maxLength(p.note, CONTRIBUTION_NOTE_MAX_LENGTH, {
    message: `A observação deve ter no máximo ${CONTRIBUTION_NOTE_MAX_LENGTH} caracteres.`,
  });
});
