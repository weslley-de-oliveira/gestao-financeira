import { CreditCard, InvoiceCycle } from '../../../shared/models/credit-card';
import { isInRange } from '../../../shared/models/period';
import { Transaction, isCardPurchase, isInvoicePayment } from '../../../shared/models/transaction';
import { IsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { invoiceCycleFor, invoiceCycleForMonth } from '../../credit-cards/domain/invoice-cycle';

export const INVOICE_STATUSES = ['open', 'closed', 'paid', 'overdue'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  overdue: 'Vencida',
};

type CardDays = Pick<CreditCard, 'id' | 'closingDay' | 'dueDay'>;

/**
 * Fatura calculada a partir das transações: não é persistida. O total é sempre a soma das compras
 * do ciclo, e o pagamento é a transação `invoice-payment` do cartão e do mês de referência.
 */
export interface Invoice extends InvoiceCycle {
  creditCardId: string;
  total: Cents;
  /** Compras do ciclo, das mais recentes para as mais antigas. */
  purchases: Transaction[];
  payment: Transaction | null;
  status: InvoiceStatus;
}

/**
 * Status pela data atual e pelo pagamento: paga quando há pagamento; aberta até a véspera do
 * fechamento; depois, fechada até o vencimento e vencida a partir do dia seguinte.
 */
export function invoiceStatus(
  cycle: Pick<InvoiceCycle, 'closingDate' | 'dueDate'>,
  payment: Transaction | null,
  today: IsoDate,
): InvoiceStatus {
  if (payment) {
    return 'paid';
  }
  if (today < cycle.closingDate) {
    return 'open';
  }
  return today > cycle.dueDate ? 'overdue' : 'closed';
}

export function buildInvoice(
  card: CardDays,
  transactions: readonly Transaction[],
  referenceMonth: string,
  today: IsoDate,
): Invoice {
  const cycle = invoiceCycleForMonth(card, referenceMonth);
  const purchases = transactions
    .filter(
      (transaction) =>
        isCardPurchase(transaction) &&
        transaction.creditCardId === card.id &&
        isInRange(transaction.date, cycle),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const payment = findPayment(card.id, transactions, referenceMonth);

  return {
    ...cycle,
    creditCardId: card.id,
    total: purchases.reduce((total, purchase) => total + purchase.amount, 0),
    purchases,
    payment,
    status: invoiceStatus(cycle, payment, today),
  };
}

/**
 * Faturas de um cartão, da mais recente para a mais antiga: a aberta hoje e todas as que têm
 * compras ou pagamento.
 */
export function listInvoices(
  card: CardDays,
  transactions: readonly Transaction[],
  today: IsoDate,
): Invoice[] {
  const months = new Set([invoiceCycleFor(card, today).referenceMonth]);
  for (const transaction of transactions) {
    if (transaction.creditCardId !== card.id) {
      continue;
    }
    if (isCardPurchase(transaction)) {
      months.add(invoiceCycleFor(card, transaction.date).referenceMonth);
    } else if (isInvoicePayment(transaction) && transaction.invoiceMonth) {
      months.add(transaction.invoiceMonth);
    }
  }
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => buildInvoice(card, transactions, month, today));
}

/** Só se paga o valor total de uma fatura já fechada, com compras e ainda sem pagamento. */
export function canPayInvoice(invoice: Pick<Invoice, 'status' | 'total'>): boolean {
  return (invoice.status === 'closed' || invoice.status === 'overdue') && invoice.total > 0;
}

/**
 * Uma compra numa fatura já paga não pode ser criada, alterada nem excluída: o total pago
 * deixaria de conferir com os itens. Desfaça o pagamento antes.
 */
export function isInvoicePaidFor(
  card: CardDays,
  transactions: readonly Transaction[],
  purchaseDate: IsoDate,
): boolean {
  const { referenceMonth } = invoiceCycleFor(card, purchaseDate);
  return findPayment(card.id, transactions, referenceMonth) !== null;
}

function findPayment(
  creditCardId: string,
  transactions: readonly Transaction[],
  referenceMonth: string,
): Transaction | null {
  return (
    transactions.find(
      (transaction) =>
        isInvoicePayment(transaction) &&
        transaction.creditCardId === creditCardId &&
        transaction.invoiceMonth === referenceMonth,
    ) ?? null
  );
}

/**
 * Motivo da recusa: fatura inexistente, que não pode ser paga (aberta, sem compras ou já paga),
 * ou conta de pagamento do cartão indisponível (arquivada ou removida).
 */
export type InvoicePaymentFailure = 'not-found' | 'not-payable' | 'payment-account';

export class InvoicePaymentError extends Error {
  constructor(readonly reason: InvoicePaymentFailure) {
    super(`Invoice payment refused: ${reason}`);
    this.name = 'InvoicePaymentError';
  }
}

/** Fatura na listagem do cartão: os mesmos dados, com a quantidade de compras no lugar delas. */
export type InvoiceSummary = Omit<Invoice, 'purchases'> & { purchaseCount: number };

export function toInvoiceSummary({ purchases, ...invoice }: Invoice): InvoiceSummary {
  return { ...invoice, purchaseCount: purchases.length };
}

/** A compra pertence a uma fatura já paga; é preciso desfazer o pagamento antes de alterá-la. */
export class PaidInvoiceError extends Error {
  constructor() {
    super('The invoice of this purchase is already paid');
    this.name = 'PaidInvoiceError';
  }
}
