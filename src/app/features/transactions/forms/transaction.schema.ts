import {
  RootFieldContext,
  hidden,
  maxLength,
  required,
  schema,
  validate,
} from '@angular/forms/signals';
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../../shared/models/transaction';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { MAX_MONEY_CENTS, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from '../../installments/domain/installment-plan';
import { TransactionInput } from '../domain/transaction-rules';

/** Despesas podem ser pagas por uma conta ou lançadas num cartão de crédito. */
export type PaymentMethod = 'account' | 'credit-card';

/**
 * Modelo do formulário: valor como texto mascarado ("1.234,56") e data como `Date` do datepicker;
 * convertidos para centavos e `yyyy-MM-dd` no envio. Selects vazios usam `''`.
 */
export interface TransactionFormModel {
  type: TransactionType;
  /** Só vale em despesas; receitas e transferências sempre usam conta. */
  paymentMethod: PaymentMethod;
  description: string;
  amount: string;
  date: Date | null;
  accountId: string;
  creditCardId: string;
  destinationAccountId: string;
  categoryId: string;
  status: TransactionStatus;
  notes: string;
  /** Só em compras no cartão novas: 1 é à vista; de 2 a 24, uma compra parcelada. */
  installments: number;
}

export const emptyTransactionForm = (
  today: Date,
  overrides: Partial<TransactionFormModel> = {},
): TransactionFormModel => ({
  type: 'expense',
  paymentMethod: 'account',
  description: '',
  amount: '',
  date: today,
  accountId: '',
  creditCardId: '',
  destinationAccountId: '',
  categoryId: '',
  status: 'completed',
  notes: '',
  installments: 1,
  ...overrides,
});

export function toTransactionFormModel(transaction: Transaction): TransactionFormModel {
  return {
    type: transaction.type,
    paymentMethod: transaction.creditCardId ? 'credit-card' : 'account',
    description: transaction.description,
    amount: formatMoneyInput(transaction.amount),
    date: parseIsoDate(transaction.date),
    accountId: transaction.accountId ?? '',
    creditCardId: transaction.creditCardId ?? '',
    destinationAccountId: transaction.destinationAccountId ?? '',
    categoryId: transaction.categoryId ?? '',
    status: transaction.status,
    notes: transaction.notes ?? '',
    installments: 1,
  };
}

/** Só deve ser chamado com o formulário válido. */
export function toTransactionInput(model: TransactionFormModel): TransactionInput {
  const amount = parseMoney(model.amount);
  if (amount === null || !model.date) {
    throw new RangeError('Invalid transaction form');
  }
  const isTransfer = model.type === 'transfer';
  const cardPurchase = isCardPurchaseModel(model);
  return {
    type: model.type,
    description: model.description,
    amount,
    date: toIsoDate(model.date),
    accountId: cardPurchase ? null : model.accountId,
    creditCardId: cardPurchase ? model.creditCardId : null,
    destinationAccountId: isTransfer ? model.destinationAccountId : null,
    categoryId: isTransfer ? null : model.categoryId,
    status: cardPurchase ? 'completed' : model.status,
    notes: model.notes || null,
  };
}

/** Despesa lançada no cartão. */
export function isCardPurchaseModel(
  model: Pick<TransactionFormModel, 'type' | 'paymentMethod'>,
): boolean {
  return model.type === 'expense' && model.paymentMethod === 'credit-card';
}

type Context = Pick<RootFieldContext<unknown>, 'valueOf'>;

export const transactionSchema = schema<TransactionFormModel>((p) => {
  const isTransfer = ({ valueOf }: Context) => valueOf(p.type) === 'transfer';
  const isCardPurchase = ({ valueOf }: Context) =>
    isCardPurchaseModel({ type: valueOf(p.type), paymentMethod: valueOf(p.paymentMethod) });

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

  hidden(p.paymentMethod, { when: (ctx) => ctx.valueOf(p.type) !== 'expense' });

  // Compra no cartão: cartão obrigatório, sem conta e sempre realizada.
  hidden(p.accountId, { when: isCardPurchase });
  required(p.accountId, { message: 'Selecione a conta.', when: (ctx) => !isCardPurchase(ctx) });
  hidden(p.creditCardId, { when: (ctx) => !isCardPurchase(ctx) });
  required(p.creditCardId, { message: 'Selecione o cartão.', when: isCardPurchase });
  hidden(p.status, { when: isCardPurchase });

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

  // Parcelas: só numa compra no cartão; ao menos R$ 0,01 por parcela.
  hidden(p.installments, { when: (ctx) => !isCardPurchase(ctx) });
  validate(p.installments, ({ value, valueOf }) => {
    const count = value();
    if (count === 1) {
      return undefined;
    }
    if (!Number.isInteger(count) || count < MIN_INSTALLMENTS || count > MAX_INSTALLMENTS) {
      return {
        kind: 'installments',
        message: `Parcele de ${MIN_INSTALLMENTS} a ${MAX_INSTALLMENTS} vezes.`,
      };
    }
    const cents = parseMoney(valueOf(p.amount));
    return cents !== null && cents < count
      ? { kind: 'installments', message: 'O valor precisa ter pelo menos R$ 0,01 por parcela.' }
      : undefined;
  });

  maxLength(p.notes, TRANSACTION_NOTES_MAX_LENGTH, {
    message: `As observações devem ter no máximo ${TRANSACTION_NOTES_MAX_LENGTH} caracteres.`,
  });
});
