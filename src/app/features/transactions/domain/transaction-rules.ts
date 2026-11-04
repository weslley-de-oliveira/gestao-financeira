import { Account } from '../../../shared/models/account';
import { Category } from '../../../shared/models/category';
import { CreditCard } from '../../../shared/models/credit-card';
import {
  EDITABLE_TRANSACTION_TYPES,
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
  TRANSACTION_STATUSES,
  Transaction,
} from '../../../shared/models/transaction';
import { isIsoDate } from '../../../shared/utils/date';
import { Cents, MAX_MONEY_CENTS, isValidCents } from '../../../shared/utils/money';
import { collapseWhitespace } from '../../../shared/utils/text';

/** Dados editáveis de uma transação, com o valor em centavos. */
export type TransactionInput = Pick<
  Transaction,
  | 'type'
  | 'description'
  | 'amount'
  | 'date'
  | 'accountId'
  | 'creditCardId'
  | 'destinationAccountId'
  | 'categoryId'
  | 'status'
  | 'notes'
>;

export class InvalidTransactionInputError extends Error {
  constructor(readonly field: keyof TransactionInput) {
    super(`Invalid transaction ${field}`);
    this.name = 'InvalidTransactionInputError';
  }
}

/**
 * Valida e normaliza os dados da transação. Transferências exigem contas diferentes e não têm
 * categoria; receitas e despesas exigem categoria e não têm conta de destino. Compras no cartão
 * são despesas sem conta e sempre realizadas: comprometem o limite desde a data da compra.
 * Pagamentos de fatura não passam por aqui: são criados pela facade de Faturas.
 */
export function normalizeTransactionInput(input: TransactionInput): TransactionInput {
  const description = collapseWhitespace(input.description);
  const notes = input.notes?.trim() || null;
  const isTransfer = input.type === 'transfer';
  const cardPurchase = !!input.creditCardId;

  if (!EDITABLE_TRANSACTION_TYPES.some((type) => type === input.type)) {
    throw new InvalidTransactionInputError('type');
  }
  if (!description || description.length > TRANSACTION_DESCRIPTION_MAX_LENGTH) {
    throw new InvalidTransactionInputError('description');
  }
  if (!isValidCents(input.amount) || input.amount <= 0 || input.amount > MAX_MONEY_CENTS) {
    throw new InvalidTransactionInputError('amount');
  }
  if (!isIsoDate(input.date)) {
    throw new InvalidTransactionInputError('date');
  }
  if (cardPurchase && input.type !== 'expense') {
    throw new InvalidTransactionInputError('creditCardId');
  }
  if (!cardPurchase && !input.accountId) {
    throw new InvalidTransactionInputError('accountId');
  }
  if (
    isTransfer &&
    (!input.destinationAccountId || input.destinationAccountId === input.accountId)
  ) {
    throw new InvalidTransactionInputError('destinationAccountId');
  }
  if (!isTransfer && !input.categoryId) {
    throw new InvalidTransactionInputError('categoryId');
  }
  if (!TRANSACTION_STATUSES.includes(input.status)) {
    throw new InvalidTransactionInputError('status');
  }
  if (notes && notes.length > TRANSACTION_NOTES_MAX_LENGTH) {
    throw new InvalidTransactionInputError('notes');
  }

  return {
    ...input,
    description,
    notes,
    accountId: cardPurchase ? null : input.accountId,
    creditCardId: cardPurchase ? input.creditCardId : null,
    destinationAccountId: isTransfer ? input.destinationAccountId : null,
    categoryId: isTransfer ? null : input.categoryId,
    status: cardPurchase ? 'completed' : input.status,
  };
}

export interface TransactionReferences {
  accounts: readonly Pick<Account, 'id' | 'isArchived'>[];
  categories: readonly Pick<Category, 'id' | 'type' | 'isArchived'>[];
  creditCards: readonly Pick<CreditCard, 'id' | 'isArchived'>[];
}

/**
 * Conta(s), cartão e categoria devem existir entre os do usuário e estar ativos. Na edição,
 * mantêm-se válidas as referências que a transação já tinha, mesmo que tenham sido arquivadas
 * depois. A categoria deve ser do mesmo tipo da transação.
 */
export function assertValidReferences(
  input: TransactionInput,
  references: TransactionReferences,
  previous?: TransactionInput,
): void {
  const usableAccount = (id: string | null) => {
    const account = references.accounts.find((item) => item.id === id);
    return (
      !!account &&
      (!account.isArchived || id === previous?.accountId || id === previous?.destinationAccountId)
    );
  };

  if (input.creditCardId) {
    const card = references.creditCards.find((item) => item.id === input.creditCardId);
    if (!card || (card.isArchived && card.id !== previous?.creditCardId)) {
      throw new InvalidTransactionInputError('creditCardId');
    }
  } else if (!usableAccount(input.accountId)) {
    throw new InvalidTransactionInputError('accountId');
  }
  if (input.type === 'transfer') {
    if (!usableAccount(input.destinationAccountId)) {
      throw new InvalidTransactionInputError('destinationAccountId');
    }
    return;
  }
  const category = references.categories.find((item) => item.id === input.categoryId);
  if (
    !category ||
    category.type !== input.type ||
    (category.isArchived && category.id !== previous?.categoryId)
  ) {
    throw new InvalidTransactionInputError('categoryId');
  }
}

export interface TransactionSummary {
  income: Cents;
  expense: Cents;
  /** Receitas − despesas. */
  net: Cents;
  pendingCount: number;
}

/** Totais de receitas e despesas realizadas. Transferências não entram nos totais. */
export function summarizeTransactions(transactions: readonly Transaction[]): TransactionSummary {
  let income = 0;
  let expense = 0;
  let pendingCount = 0;
  for (const transaction of transactions) {
    if (transaction.status === 'pending') {
      pendingCount++;
    } else if (transaction.type === 'income') {
      income += transaction.amount;
    } else if (transaction.type === 'expense') {
      expense += transaction.amount;
    }
  }
  return { income, expense, net: income - expense, pendingCount };
}
