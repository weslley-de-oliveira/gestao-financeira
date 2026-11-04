import { maxLength, required, schema, validate } from '@angular/forms/signals';
import {
  ACCOUNT_INSTITUTION_MAX_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
  Account,
  AccountType,
} from '../../../shared/models/account';
import { APPEARANCE_COLORS } from '../../../shared/models/appearance';
import { MAX_MONEY_CENTS, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { AccountInput } from '../domain/account-input';

/** Modelo do formulário: o saldo é digitado como texto e convertido para centavos no envio. */
export interface AccountFormModel {
  name: string;
  type: AccountType;
  institution: string;
  initialBalance: string;
  color: string;
  icon: string;
  isArchived: boolean;
}

export const emptyAccountForm = (): AccountFormModel => ({
  name: '',
  type: 'checking',
  institution: '',
  initialBalance: '0,00',
  color: APPEARANCE_COLORS[0].value,
  icon: 'account_balance',
  isArchived: false,
});

export function toAccountFormModel(account: Account): AccountFormModel {
  return {
    name: account.name,
    type: account.type,
    institution: account.institution ?? '',
    initialBalance: formatMoneyInput(account.initialBalance),
    color: account.color,
    icon: account.icon,
    isArchived: account.isArchived,
  };
}

/** Só deve ser chamado com o formulário válido. */
export function toAccountInput(model: AccountFormModel): AccountInput {
  const initialBalance = parseMoney(model.initialBalance);
  if (initialBalance === null) {
    throw new RangeError('Invalid initial balance');
  }
  return {
    name: model.name,
    type: model.type,
    institution: model.institution || null,
    initialBalance,
    color: model.color,
    icon: model.icon,
    isArchived: model.isArchived,
  };
}

export const accountSchema = schema<AccountFormModel>((p) => {
  required(p.name, { message: 'Informe o nome da conta.' });
  validate(p.name, ({ value }) =>
    value() && !value().trim() ? { kind: 'blank', message: 'Informe o nome da conta.' } : undefined,
  );
  maxLength(p.name, ACCOUNT_NAME_MAX_LENGTH, {
    message: `O nome deve ter no máximo ${ACCOUNT_NAME_MAX_LENGTH} caracteres.`,
  });

  required(p.type, { message: 'Selecione o tipo.' });

  maxLength(p.institution, ACCOUNT_INSTITUTION_MAX_LENGTH, {
    message: `A instituição deve ter no máximo ${ACCOUNT_INSTITUTION_MAX_LENGTH} caracteres.`,
  });

  required(p.initialBalance, { message: 'Informe o saldo inicial.' });
  validate(p.initialBalance, ({ value }) => {
    if (!value()) {
      return undefined;
    }
    const cents = parseMoney(value());
    if (cents === null) {
      return { kind: 'money', message: 'Informe um valor válido, como 1.234,56.' };
    }
    return Math.abs(cents) > MAX_MONEY_CENTS
      ? { kind: 'moneyRange', message: 'O valor deve ser de até R$ 1 bilhão.' }
      : undefined;
  });
});
