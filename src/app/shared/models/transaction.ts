import { Cents } from '../utils/money';

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionType, string>> = {
  expense: 'Despesa',
  income: 'Receita',
  transfer: 'Transferência',
};

export const TRANSACTION_STATUSES = ['completed', 'pending'] as const;

/** Só transações realizadas alteram o saldo; pendentes ficam registradas para acompanhamento. */
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Readonly<Record<TransactionStatus, string>> = {
  completed: 'Realizada',
  pending: 'Pendente',
};

export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 80;
export const TRANSACTION_NOTES_MAX_LENGTH = 500;

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  description: string;
  /** Sempre positivo; o tipo define o efeito no saldo. */
  amount: Cents;
  /** Data da transação, sem horário: `yyyy-MM-dd`. */
  date: string;
  /** Conta da receita/despesa ou conta de origem da transferência. */
  accountId: string;
  /** Apenas em transferências. */
  destinationAccountId: string | null;
  /** Obrigatória em receitas e despesas, compatível com o tipo; `null` em transferências. */
  categoryId: string | null;
  status: TransactionStatus;
  notes: string | null;
  createdAt: string;
}
