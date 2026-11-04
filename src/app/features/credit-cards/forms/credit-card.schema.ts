import { maxLength, pattern, required, schema, validate } from '@angular/forms/signals';
import { APPEARANCE_COLORS } from '../../../shared/models/appearance';
import {
  CREDIT_CARD_NAME_MAX_LENGTH,
  CardBrand,
  CreditCard,
  MAX_CARD_DAY,
  MIN_CARD_DAY,
} from '../../../shared/models/credit-card';
import { MAX_MONEY_CENTS, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { CreditCardInput, LAST_FOUR_DIGITS_PATTERN } from '../domain/credit-card-input';

/** Modelo do formulário: limite como texto mascarado, convertido para centavos no envio. */
export interface CreditCardFormModel {
  name: string;
  brand: CardBrand;
  lastFourDigits: string;
  creditLimit: string;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
  color: string;
  isArchived: boolean;
}

/** Opções dos selects de fechamento e vencimento: 1 a 31. */
export const CARD_DAY_OPTIONS: readonly number[] = Array.from(
  { length: MAX_CARD_DAY - MIN_CARD_DAY + 1 },
  (_, index) => MIN_CARD_DAY + index,
);

export const emptyCreditCardForm = (
  overrides: Partial<CreditCardFormModel> = {},
): CreditCardFormModel => ({
  name: '',
  brand: 'visa',
  lastFourDigits: '',
  creditLimit: '',
  closingDay: 1,
  dueDay: 10,
  paymentAccountId: '',
  color: APPEARANCE_COLORS[2].value,
  isArchived: false,
  ...overrides,
});

export function toCreditCardFormModel(card: CreditCard): CreditCardFormModel {
  return {
    name: card.name,
    brand: card.brand,
    lastFourDigits: card.lastFourDigits,
    creditLimit: formatMoneyInput(card.creditLimit),
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    paymentAccountId: card.paymentAccountId,
    color: card.color,
    isArchived: card.isArchived,
  };
}

/** Só deve ser chamado com o formulário válido. */
export function toCreditCardInput(model: CreditCardFormModel): CreditCardInput {
  const creditLimit = parseMoney(model.creditLimit);
  if (creditLimit === null) {
    throw new RangeError('Invalid credit limit');
  }
  return { ...model, creditLimit };
}

export const creditCardSchema = schema<CreditCardFormModel>((p) => {
  required(p.name, { message: 'Informe o apelido do cartão.' });
  validate(p.name, ({ value }) =>
    value() && !value().trim()
      ? { kind: 'blank', message: 'Informe o apelido do cartão.' }
      : undefined,
  );
  maxLength(p.name, CREDIT_CARD_NAME_MAX_LENGTH, {
    message: `O apelido deve ter no máximo ${CREDIT_CARD_NAME_MAX_LENGTH} caracteres.`,
  });

  required(p.brand, { message: 'Selecione a bandeira.' });

  required(p.lastFourDigits, { message: 'Informe os quatro últimos dígitos.' });
  // O `maxlength` do campo impede digitar ou colar o número completo do cartão.
  maxLength(p.lastFourDigits, 4, { message: 'Informe exatamente quatro números.' });
  pattern(p.lastFourDigits, LAST_FOUR_DIGITS_PATTERN, {
    message: 'Informe exatamente quatro números.',
  });

  required(p.creditLimit, { message: 'Informe o limite.' });
  validate(p.creditLimit, ({ value }) => {
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

  required(p.closingDay, { message: 'Selecione o dia de fechamento.' });
  required(p.dueDay, { message: 'Selecione o dia de vencimento.' });
  validate(p.dueDay, ({ value, valueOf }) =>
    value() === valueOf(p.closingDay)
      ? { kind: 'sameDay', message: 'O vencimento deve ser diferente do fechamento.' }
      : undefined,
  );

  required(p.paymentAccountId, { message: 'Selecione a conta de pagamento.' });
});
