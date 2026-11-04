import { Transaction, TransactionStatus, TransactionType } from '../../shared/models/transaction';

/** Formato do recurso `transactions` na API. Valor em centavos inteiros e data `yyyy-MM-dd`. */
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
  destinationAccountId: string | null;
  categoryId: string | null;
  status: TransactionStatus;
  notes: string | null;
  createdAt: string;
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
    destinationAccountId: dto.destinationAccountId ?? null,
    categoryId: dto.categoryId ?? null,
    status: dto.status ?? 'completed',
    notes: dto.notes ?? null,
    createdAt: dto.createdAt,
  };
}

export function toTransactionDto(transaction: Transaction): TransactionDto {
  return { ...transaction };
}
