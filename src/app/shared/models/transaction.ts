import { Cents } from '../utils/money';

export const TRANSACTION_TYPES = [
  'expense',
  'income',
  'transfer',
  'invoice-payment',
  'refund',
] as const;

/**
 * `invoice-payment` é o pagamento de uma fatura de cartão: debita a conta de pagamento, mas não é
 * despesa (as compras já foram contadas). É criado e desfeito apenas pela tela de Faturas.
 *
 * `refund` é o estorno de uma despesa realizada, na conta ou no cartão dela: devolve o valor à
 * conta ou abate a fatura, e reduz o gasto da categoria da despesa no mês do estorno. É criado
 * pelo detalhe da despesa.
 */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Tipos que a pessoa cria e edita pelo formulário de transações. */
export const EDITABLE_TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;

export type EditableTransactionType = (typeof EDITABLE_TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionType, string>> = {
  expense: 'Despesa',
  income: 'Receita',
  transfer: 'Transferência',
  'invoice-payment': 'Pagamento de fatura',
  refund: 'Estorno',
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
  /**
   * Conta da receita/despesa, conta de origem da transferência ou conta que pagou a fatura.
   * `null` nas compras no cartão: elas não alteram o saldo de nenhuma conta.
   */
  accountId: string | null;
  /**
   * Cartão de uma compra (despesa sempre realizada, sem conta) ou da fatura paga; `null` nas
   * demais transações.
   */
  creditCardId: string | null;
  /** Mês de referência (`yyyy-MM`) da fatura paga; apenas em `invoice-payment`. */
  invoiceMonth: string | null;
  /** Apenas em transferências. */
  destinationAccountId: string | null;
  /**
   * Obrigatória em receitas e despesas, compatível com o tipo; `null` nos demais tipos (o estorno
   * conta na categoria da despesa estornada).
   */
  categoryId: string | null;
  status: TransactionStatus;
  notes: string | null;
  createdAt: string;
  /** Versão do registro na API, enviada no `If-Match` das edições; ausente na demo. */
  updatedAt?: string;
  /**
   * Parcela de uma compra parcelada no cartão: a compra (o mesmo id em todas as parcelas), o número
   * da parcela e o total de parcelas. Ausentes (ou `null`) nas demais transações.
   */
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  /** Despesa estornada; só em `refund`. Ausente (ou `null`) nas demais transações. */
  refundedTransactionId?: string | null;
}

/** Compra no cartão de crédito: despesa sem conta, lançada na fatura do cartão. */
export function isCardPurchase(transaction: Pick<Transaction, 'type' | 'creditCardId'>): boolean {
  return transaction.type === 'expense' && transaction.creditCardId !== null;
}

export function isInvoicePayment(transaction: Pick<Transaction, 'type'>): boolean {
  return transaction.type === 'invoice-payment';
}

/** Estorno de uma despesa: na conta dela (devolve o valor) ou no cartão (abate a fatura). */
export function isRefund(transaction: Pick<Transaction, 'type'>): boolean {
  return transaction.type === 'refund';
}

/** Estorno lançado no cartão: abate a fatura em que a data dele cai. */
export function isCardRefund(transaction: Pick<Transaction, 'type' | 'creditCardId'>): boolean {
  return transaction.type === 'refund' && transaction.creditCardId !== null;
}

/** Parcela de uma compra parcelada: só muda pela compra inteira. */
export function isInstallment(transaction: Pick<Transaction, 'installmentGroupId'>): boolean {
  return !!transaction.installmentGroupId;
}
