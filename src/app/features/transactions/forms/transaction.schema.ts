import { hidden, maxLength, required, schema, validate } from '@angular/forms/signals';
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../../shared/models/transaction';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { MAX_MONEY_CENTS, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { TransactionInput } from '../domain/transaction-rules';

/**
 * Modelo do formulário: valor como texto mascarado ("1.234,56") e data como `Date` do datepicker;
 * convertidos para centavos e `yyyy-MM-dd` no envio. Selects vazios usam `''`.
 */
export interface TransactionFormModel {
  type: TransactionType;
  description: string;
  amount: string;
  date: Date | null;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  status: TransactionStatus;
  notes: string;
}

export const emptyTransactionForm = (
  today: Date,
  overrides: Partial<TransactionFormModel> = {},
): TransactionFormModel => ({
  type: 'expense',
  description: '',
  amount: '',
  date: today,
  accountId: '',
  destinationAccountId: '',
  categoryId: '',
  status: 'completed',
  notes: '',
  ...overrides,
});

export function toTransactionFormModel(transaction: Transaction): TransactionFormModel {
  return {
    type: transaction.type,
    description: transaction.description,
    amount: formatMoneyInput(transaction.amount),
    date: parseIsoDate(transaction.date),
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId ?? '',
    categoryId: transaction.categoryId ?? '',
    status: transaction.status,
    notes: transaction.notes ?? '',
  };
}

/** Só deve ser chamado com o formulário válido. */
export function toTransactionInput(model: TransactionFormModel): TransactionInput {
  const amount = parseMoney(model.amount);
  if (amount === null || !model.date) {
    throw new RangeError('Invalid transaction form');
  }
  const isTransfer = model.type === 'transfer';
  return {
    type: model.type,
    description: model.description,
    amount,
    date: toIsoDate(model.date),
    accountId: model.accountId,
    destinationAccountId: isTransfer ? model.destinationAccountId : null,
    categoryId: isTransfer ? null : model.categoryId,
    status: model.status,
    notes: model.notes || null,
  };
}

export const transactionSchema = schema<TransactionFormModel>((p) => {
  const isTransfer = ({ valueOf }: { valueOf: (path: typeof p.type) => TransactionType }) =>
    valueOf(p.type) === 'transfer';

  required(p.description, { message: 'Informe a descrição.' });
  validate(p.description, ({ value }) =>
    value() && !value().trim() ? { kind: 'blank', message: 'Informe a descrição.' } : undefined,
  );
  maxLength(p.description, TRANSACTION_DESCRIPTION_MAX_LENGTH, {
    message: `A descrição deve ter no máximo ${TRANSACTION_DESCRIPTION_MAX_LENGTH} caracteres.`,
  });

  required(p.amount, { message: 'Informe o valor.' });
  validate(p.amount, ({ value }) => {
    if (!value()) {
      return undefined;
    }
    const cents = parseMoney(value());
    if (cents === null || cents <= 0) {
      return { kind: 'positive', message: 'O valor deve ser maior que zero.' };
    }
    return cents > MAX_MONEY_CENTS
      ? { kind: 'moneyRange', message: 'O valor deve ser de até R$ 1 bilhão.' }
      : undefined;
  });

  required(p.date, { message: 'Informe a data.' });

  required(p.accountId, { message: 'Selecione a conta.' });

  // Transferência: conta de destino obrigatória e diferente da origem; sem categoria.
  hidden(p.destinationAccountId, { when: (ctx) => !isTransfer(ctx) });
  required(p.destinationAccountId, {
    message: 'Selecione a conta de destino.',
    when: isTransfer,
  });
  validate(p.destinationAccountId, ({ value, valueOf }) =>
    valueOf(p.type) === 'transfer' && value() && value() === valueOf(p.accountId)
      ? { kind: 'sameAccount', message: 'Escolha uma conta diferente da conta de origem.' }
      : undefined,
  );

  hidden(p.categoryId, { when: isTransfer });
  required(p.categoryId, {
    message: 'Selecione a categoria.',
    when: (ctx) => !isTransfer(ctx),
  });

  maxLength(p.notes, TRANSACTION_NOTES_MAX_LENGTH, {
    message: `As observações devem ter no máximo ${TRANSACTION_NOTES_MAX_LENGTH} caracteres.`,
  });
});
