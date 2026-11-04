import { APPEARANCE_COLORS, isAppearanceOption } from '../../../shared/models/appearance';
import {
  CARD_BRANDS,
  CREDIT_CARD_NAME_MAX_LENGTH,
  CreditCard,
  MAX_CARD_DAY,
  MIN_CARD_DAY,
} from '../../../shared/models/credit-card';
import { MAX_MONEY_CENTS, isValidCents } from '../../../shared/utils/money';
import { collapseWhitespace } from '../../../shared/utils/text';

/** Dados editáveis de um cartão, já com o limite em centavos. */
export type CreditCardInput = Pick<
  CreditCard,
  | 'name'
  | 'brand'
  | 'lastFourDigits'
  | 'creditLimit'
  | 'closingDay'
  | 'dueDay'
  | 'paymentAccountId'
  | 'color'
  | 'isArchived'
>;

export class InvalidCreditCardInputError extends Error {
  constructor(readonly field: keyof CreditCardInput) {
    super(`Invalid credit card ${field}`);
    this.name = 'InvalidCreditCardInputError';
  }
}

/** Somente os quatro últimos dígitos: um número completo de cartão nunca é aceito. */
export const LAST_FOUR_DIGITS_PATTERN = /^\d{4}$/;

export function isValidCardDay(day: number): boolean {
  return Number.isInteger(day) && day >= MIN_CARD_DAY && day <= MAX_CARD_DAY;
}

/**
 * Normaliza e valida os dados antes de persistir. O formulário já valida para a UX; esta é a
 * regra de domínio, que vale para qualquer origem dos dados.
 */
export function normalizeCreditCardInput(input: CreditCardInput): CreditCardInput {
  const name = collapseWhitespace(input.name);

  if (!name || name.length > CREDIT_CARD_NAME_MAX_LENGTH) {
    throw new InvalidCreditCardInputError('name');
  }
  if (!CARD_BRANDS.includes(input.brand)) {
    throw new InvalidCreditCardInputError('brand');
  }
  if (!LAST_FOUR_DIGITS_PATTERN.test(input.lastFourDigits)) {
    throw new InvalidCreditCardInputError('lastFourDigits');
  }
  if (
    !isValidCents(input.creditLimit) ||
    input.creditLimit <= 0 ||
    input.creditLimit > MAX_MONEY_CENTS
  ) {
    throw new InvalidCreditCardInputError('creditLimit');
  }
  if (!isValidCardDay(input.closingDay)) {
    throw new InvalidCreditCardInputError('closingDay');
  }
  if (!isValidCardDay(input.dueDay) || input.dueDay === input.closingDay) {
    throw new InvalidCreditCardInputError('dueDay');
  }
  if (!input.paymentAccountId) {
    throw new InvalidCreditCardInputError('paymentAccountId');
  }
  if (!isAppearanceOption(APPEARANCE_COLORS, input.color)) {
    throw new InvalidCreditCardInputError('color');
  }

  return { ...input, name };
}
