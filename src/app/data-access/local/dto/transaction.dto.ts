import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../../shared/models/transaction';

/** Registro de `transactions` no `localStorage` da demo (e no seed). Centavos e data `yyyy-MM-dd`. */
export interface TransactionDto {
  id: string;
  userId: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  accountId: string | null;
  /** Ausente nos registros anteriores aos cartões. */
  creditCardId?: string | null;
  /** Ausente nos registros anteriores às faturas. */
  invoiceMonth?: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  status: TransactionStatus;
  notes: string | null;
  createdAt: string;
  /** Só nas parcelas de uma compra parcelada. */
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  /** Só nos estornos: a despesa estornada. */
  refundedTransactionId?: string | null;
}

export function toTransaction(dto: TransactionDto): Transaction {
  return {
    id: dto.id,
    userId: dto.userId,
    type: dto.type,
    description: dto.description,
    amount: dto.amount,
    date: dto.date,
    accountId: dto.accountId ?? null,
    creditCardId: dto.creditCardId ?? null,
    invoiceMonth: dto.invoiceMonth ?? null,
    destinationAccountId: dto.destinationAccountId ?? null,
    categoryId: dto.categoryId ?? null,
    status: dto.status ?? 'completed',
    notes: dto.notes ?? null,
    createdAt: dto.createdAt,
    ...(dto.installmentGroupId && {
      installmentGroupId: dto.installmentGroupId,
      installmentNumber: dto.installmentNumber ?? null,
      installmentCount: dto.installmentCount ?? null,
    }),
    ...(dto.refundedTransactionId && { refundedTransactionId: dto.refundedTransactionId }),
  };
}

export function toTransactionDto(transaction: Transaction): TransactionDto {
  return { ...transaction };
}
