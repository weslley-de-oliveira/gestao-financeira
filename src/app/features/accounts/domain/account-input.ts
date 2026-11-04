import {
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
  ACCOUNT_INSTITUTION_MAX_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_TYPES,
  Account,
} from '../../../shared/models/account';
import { MAX_MONEY_CENTS, isValidCents } from '../../../shared/utils/money';

/** Dados editáveis de uma conta, já com o saldo inicial em centavos. */
export type AccountInput = Pick<
  Account,
  'name' | 'type' | 'institution' | 'initialBalance' | 'color' | 'icon' | 'isArchived'
>;

export class InvalidAccountInputError extends Error {
  constructor(readonly field: keyof AccountInput) {
    super(`Invalid account ${field}`);
    this.name = 'InvalidAccountInputError';
  }
}

/**
 * Normaliza e valida os dados antes de persistir. O formulário já valida para a UX;
 * esta é a regra de domínio, que vale para qualquer origem dos dados.
 */
export function normalizeAccountInput(input: AccountInput): AccountInput {
  const name = input.name.trim();
  const institution = input.institution?.trim() || null;

  if (!name || name.length > ACCOUNT_NAME_MAX_LENGTH) {
    throw new InvalidAccountInputError('name');
  }
  if (institution && institution.length > ACCOUNT_INSTITUTION_MAX_LENGTH) {
    throw new InvalidAccountInputError('institution');
  }
  if (!ACCOUNT_TYPES.includes(input.type)) {
    throw new InvalidAccountInputError('type');
  }
  if (!isValidCents(input.initialBalance) || Math.abs(input.initialBalance) > MAX_MONEY_CENTS) {
    throw new InvalidAccountInputError('initialBalance');
  }
  if (!ACCOUNT_COLORS.some((option) => option.value === input.color)) {
    throw new InvalidAccountInputError('color');
  }
  if (!ACCOUNT_ICONS.some((option) => option.value === input.icon)) {
    throw new InvalidAccountInputError('icon');
  }

  return { ...input, name, institution };
}
