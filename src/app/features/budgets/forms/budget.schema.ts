import { required, schema, validate } from '@angular/forms/signals';
import { Budget, DEFAULT_ALERT_THRESHOLD } from '../../../shared/models/budget';
import { MAX_MONEY_CENTS, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { BudgetInput, currentLimit } from '../domain/budget-rules';

/** Modelo do formulário: limite como texto mascarado, convertido para centavos no envio. */
export interface BudgetFormModel {
  categoryId: string;
  limitAmount: string;
  alertThreshold: number;
}

export const emptyBudgetForm = (overrides: Partial<BudgetFormModel> = {}): BudgetFormModel => ({
  categoryId: '',
  limitAmount: '',
  alertThreshold: DEFAULT_ALERT_THRESHOLD,
  ...overrides,
});

export function toBudgetFormModel(budget: Budget): BudgetFormModel {
  return {
    categoryId: budget.categoryId,
    limitAmount: formatMoneyInput(currentLimit(budget)),
    alertThreshold: budget.alertThreshold,
  };
}

/** Só deve ser chamado com o formulário válido. */
export function toBudgetInput(model: BudgetFormModel): BudgetInput {
  const limitAmount = parseMoney(model.limitAmount);
  if (limitAmount === null) {
    throw new RangeError('Invalid budget limit');
  }
  return { ...model, limitAmount };
}

export const budgetSchema = schema<BudgetFormModel>((p) => {
  required(p.categoryId, { message: 'Selecione a categoria.' });

  required(p.limitAmount, { message: 'Informe o limite mensal.' });
  validate(p.limitAmount, ({ value }) => {
    if (!value()) {
      return undefined;
    }
    const cents = parseMoney(value());
    if (cents === null || cents <= 0) {
      return { kind: 'positive', message: 'O limite deve ser maior que zero.' };
    }
    return cents > MAX_MONEY_CENTS
      ? { kind: 'moneyRange', message: 'O valor deve ser de até R$ 1 bilhão.' }
      : undefined;
  });

  required(p.alertThreshold, { message: 'Selecione o percentual de alerta.' });
});
