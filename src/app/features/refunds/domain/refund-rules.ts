import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
  Transaction,
} from '../../../shared/models/transaction';
import { IsoDate, isIsoDate } from '../../../shared/utils/date';
import { Cents, MAX_MONEY_CENTS, isValidCents } from '../../../shared/utils/money';
import { collapseWhitespace } from '../../../shared/utils/text';

/**
 * Estorno de uma despesa: valor (até o que falta estornar), data (não anterior à despesa),
 * descrição e observações. A conta ou o cartão e a categoria são os da despesa.
 */
export interface RefundInput {
  description: string;
  amount: Cents;
  date: IsoDate;
  notes: string | null;
}

export class InvalidRefundInputError extends Error {
  constructor(readonly field: keyof RefundInput) {
    super(`Invalid refund ${field}`);
    this.name = 'InvalidRefundInputError';
  }
}

/** Só despesas realizadas recebem estorno; uma despesa pendente se corrige editando. */
export class NotRefundableError extends Error {
  constructor() {
    super('Only completed expenses can be refunded');
    this.name = 'NotRefundableError';
  }
}

/**
 * A despesa tem estornos: exclua-os antes de excluí-la ou de mudar valor, data, conta, cartão,
 * tipo ou status (descrição, categoria e observações mudam livremente).
 */
export class HasRefundsError extends Error {
  constructor() {
    super('The expense has refunds');
    this.name = 'HasRefundsError';
  }
}

/** Campos de uma despesa com estornos que podem mudar sem excluir os estornos. */
export const FIELDS_KEPT_WITH_REFUNDS: readonly (keyof Transaction)[] = [
  'description',
  'categoryId',
  'notes',
];

export function canRefund(transaction: Pick<Transaction, 'type' | 'status'>): boolean {
  return transaction.type === 'expense' && transaction.status === 'completed';
}

export function refundedTotal(refunds: readonly Pick<Transaction, 'amount'>[]): Cents {
  return refunds.reduce((total, refund) => total + refund.amount, 0);
}

/** O que falta estornar da despesa (na edição, sem contar o próprio estorno). */
export function remainingToRefund(
  expense: Pick<Transaction, 'amount'>,
  refunds: readonly Pick<Transaction, 'id' | 'amount'>[],
  editingId?: string,
): Cents {
  return expense.amount - refundedTotal(refunds.filter((refund) => refund.id !== editingId));
}

/** Descrição padrão: "Estorno: " seguido da descrição da despesa, no tamanho máximo. */
export function defaultRefundDescription(expense: Pick<Transaction, 'description'>): string {
  return `Estorno: ${expense.description}`.slice(0, TRANSACTION_DESCRIPTION_MAX_LENGTH);
}

/**
 * Valida e normaliza o estorno: valor positivo até o que falta estornar e data não anterior à
 * despesa (as mesmas regras da API).
 */
export function normalizeRefundInput(
  input: RefundInput,
  expense: Pick<Transaction, 'date'>,
  remaining: Cents,
): RefundInput {
  const description = collapseWhitespace(input.description);
  const notes = input.notes?.trim() || null;
  if (!description || description.length > TRANSACTION_DESCRIPTION_MAX_LENGTH) {
    throw new InvalidRefundInputError('description');
  }
  if (
    !isValidCents(input.amount) ||
    input.amount <= 0 ||
    input.amount > MAX_MONEY_CENTS ||
    input.amount > remaining
  ) {
    throw new InvalidRefundInputError('amount');
  }
  if (!isIsoDate(input.date) || input.date < expense.date) {
    throw new InvalidRefundInputError('date');
  }
  if (notes && notes.length > TRANSACTION_NOTES_MAX_LENGTH) {
    throw new InvalidRefundInputError('notes');
  }
  return { description, amount: input.amount, date: input.date, notes };
}
