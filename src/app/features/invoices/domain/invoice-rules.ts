import { CreditCard, InvoiceCycle } from '../../../shared/models/credit-card';
import {
  Transaction,
  isCardPurchase,
  isCardRefund,
  isInvoicePayment,
} from '../../../shared/models/transaction';
import { IsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { IsoMonth, shiftMonth } from '../../../shared/utils/month';
import { invoiceCycleFor, invoiceCycleForMonth } from '../../credit-cards/domain/invoice-cycle';

export const INVOICE_STATUSES = ['open', 'closed', 'paid', 'overdue', 'carried-over'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  overdue: 'Vencida',
  'carried-over': 'Transferida',
};

type CardDays = Pick<CreditCard, 'id' | 'closingDay' | 'dueDay'>;

/**
 * Fatura calculada a partir das transações: não é persistida. O total é a soma das compras do
 * ciclo menos os estornos lançados nele. O saldo que sobra (o que faltou pagar, ou o crédito)
 * passa para a fatura seguinte quando ela fecha, como saldo anterior. Os pagamentos são as
 * transações `invoice-payment` do cartão e do mês de referência.
 */
export interface Invoice extends InvoiceCycle {
  creditCardId: string;
  /** Compras − estornos do ciclo; negativo quando os estornos superam as compras. */
  total: Cents;
  /**
   * Saldo da fatura anterior, trazido no fechamento desta (zero enquanto ela está aberta):
   * positivo é o que faltou pagar; negativo, crédito.
   */
  previousBalance: Cents;
  /** Saldo anterior + total do ciclo. */
  amountDue: Cents;
  /** Soma dos pagamentos. */
  paidAmount: Cents;
  /** Total a pagar − pago: positivo é o que falta pagar; negativo, crédito. */
  balance: Cents;
  /** Compras do ciclo, das mais recentes para as mais antigas. */
  purchases: Transaction[];
  /** Estornos lançados no ciclo, dos mais recentes para os mais antigos. */
  refunds: Transaction[];
  /** Pagamentos, do mais recente para o mais antigo. */
  payments: Transaction[];
  /** O pagamento mais recente. */
  payment: Transaction | null;
  status: InvoiceStatus;
}

/**
 * Status pela data atual e pelo saldo:
 * - aberta até a véspera do fechamento;
 * - paga quando fechada sem saldo a pagar (inclui a zerada pelos estornos e a com crédito);
 * - com saldo: fechada até o vencimento, vencida depois dele e transferida a partir do fechamento
 *   da fatura seguinte, quando o saldo passa para ela.
 */
export function invoiceStatus(
  cycle: Pick<InvoiceCycle, 'closingDate' | 'dueDate'>,
  balance: Cents,
  nextClosingDate: IsoDate,
  today: IsoDate,
): InvoiceStatus {
  if (today < cycle.closingDate) {
    return 'open';
  }
  if (balance <= 0) {
    return 'paid';
  }
  if (today >= nextClosingDate) {
    return 'carried-over';
  }
  return today > cycle.dueDate ? 'overdue' : 'closed';
}

/** Fatura de um mês de referência, com o saldo trazido das anteriores. */
export function buildInvoice(
  card: CardDays,
  transactions: readonly Transaction[],
  referenceMonth: IsoMonth,
  today: IsoDate,
): Invoice {
  // Recusa um mês inválido (RangeError) antes de montar a cadeia.
  invoiceCycleForMonth(card, referenceMonth);
  const invoice = invoiceChain(card, transactions, today, referenceMonth).get(referenceMonth);
  if (!invoice) {
    throw new RangeError(`Invalid reference month: ${referenceMonth}`);
  }
  return invoice;
}

/**
 * Faturas de um cartão, da mais recente para a mais antiga: a aberta hoje e todas as que têm
 * compras, estornos, pagamentos ou saldo anterior.
 */
export function listInvoices(
  card: CardDays,
  transactions: readonly Transaction[],
  today: IsoDate,
): Invoice[] {
  const groups = groupByInvoice(card, transactions);
  const current = invoiceCycleFor(card, today).referenceMonth;
  return [...invoiceChain(card, transactions, today).values()]
    .filter(
      (invoice) =>
        invoice.referenceMonth === current ||
        groups.has(invoice.referenceMonth) ||
        invoice.previousBalance !== 0,
    )
    .reverse();
}

/** Paga-se, em uma ou mais partes, a fatura fechada ou vencida que ainda tem saldo. */
export function canPayInvoice(invoice: Pick<Invoice, 'status' | 'balance'>): boolean {
  return (invoice.status === 'closed' || invoice.status === 'overdue') && invoice.balance > 0;
}

/**
 * Uma compra (ou um estorno) não pode ser criada, alterada nem excluída quando a fatura dela, ou
 * uma posterior, tem pagamento: o saldo de cada fatura entra na seguinte, e o valor pago deixaria
 * de conferir. Desfaça o pagamento antes.
 */
export function isInvoicePaidFor(
  card: CardDays,
  transactions: readonly Transaction[],
  purchaseDate: IsoDate,
): boolean {
  const { referenceMonth } = invoiceCycleFor(card, purchaseDate);
  return transactions.some(
    (transaction) =>
      isInvoicePayment(transaction) &&
      transaction.creditCardId === card.id &&
      !!transaction.invoiceMonth &&
      transaction.invoiceMonth >= referenceMonth,
  );
}

interface InvoiceItems {
  purchases: Transaction[];
  refunds: Transaction[];
  payments: Transaction[];
}

/** Compras e estornos pela fatura da data; pagamentos pelo mês da fatura paga. */
function groupByInvoice(card: CardDays, transactions: readonly Transaction[]) {
  const groups = new Map<IsoMonth, InvoiceItems>();
  const add = (month: IsoMonth, key: keyof InvoiceItems, transaction: Transaction) => {
    const group = groups.get(month) ?? { purchases: [], refunds: [], payments: [] };
    group[key].push(transaction);
    groups.set(month, group);
  };
  for (const transaction of transactions) {
    if (transaction.creditCardId !== card.id) {
      continue;
    }
    if (isCardPurchase(transaction)) {
      add(invoiceCycleFor(card, transaction.date).referenceMonth, 'purchases', transaction);
    } else if (isCardRefund(transaction)) {
      add(invoiceCycleFor(card, transaction.date).referenceMonth, 'refunds', transaction);
    } else if (isInvoicePayment(transaction) && transaction.invoiceMonth) {
      add(transaction.invoiceMonth, 'payments', transaction);
    }
  }
  return groups;
}

/**
 * Todas as faturas, mês a mês, da primeira com movimentação até a última (ou até `until`), em
 * ordem cronológica. O saldo de cada uma entra na seguinte quando a seguinte fecha.
 */
function invoiceChain(
  card: CardDays,
  transactions: readonly Transaction[],
  today: IsoDate,
  until?: IsoMonth,
): Map<IsoMonth, Invoice> {
  const groups = groupByInvoice(card, transactions);
  const months = [...groups.keys(), invoiceCycleFor(card, today).referenceMonth];
  if (until) {
    months.push(until);
  }
  months.sort();
  const first = months[0];
  const last = months.at(-1);
  const chain = new Map<IsoMonth, Invoice>();
  if (!first || !last) {
    return chain;
  }

  let carried = 0;
  for (let month = first; month <= last; month = shiftMonth(month, 1)) {
    const cycle = invoiceCycleForMonth(card, month);
    const items = groups.get(month) ?? { purchases: [], refunds: [], payments: [] };
    const purchases = newestFirst(items.purchases);
    const refunds = newestFirst(items.refunds);
    const payments = newestFirst(items.payments);
    const total = sum(purchases) - sum(refunds);
    const previousBalance = today >= cycle.closingDate ? carried : 0;
    const amountDue = previousBalance + total;
    const paidAmount = sum(payments);
    const balance = amountDue - paidAmount;
    const nextClosingDate = invoiceCycleForMonth(card, shiftMonth(month, 1)).closingDate;
    chain.set(month, {
      ...cycle,
      creditCardId: card.id,
      total,
      previousBalance,
      amountDue,
      paidAmount,
      balance,
      purchases,
      refunds,
      payments,
      payment: payments[0] ?? null,
      status: invoiceStatus(cycle, balance, nextClosingDate, today),
    });
    carried = balance;
  }
  return chain;
}

/**
 * Mais recentes primeiro. No empate (mesmo dia e mesmo instante de criação), vale a ordem de
 * gravação: os registros locais são acrescentados no fim, então o último gravado vem primeiro.
 */
function newestFirst(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function sum(transactions: readonly Transaction[]): Cents {
  return transactions.reduce((total, transaction) => total + transaction.amount, 0);
}

/**
 * Motivo da recusa: fatura inexistente, que não pode ser paga (aberta, quitada ou com o saldo já
 * transferido), conta de pagamento do cartão indisponível (arquivada ou removida), valor acima do
 * saldo, ou pagamento desfeito com uma fatura posterior paga.
 */
export type InvoicePaymentFailure =
  'not-found' | 'not-payable' | 'payment-account' | 'amount' | 'later-payment';

export class InvoicePaymentError extends Error {
  constructor(readonly reason: InvoicePaymentFailure) {
    super(`Invoice payment refused: ${reason}`);
    this.name = 'InvoicePaymentError';
  }
}

/**
 * Fatura na listagem do cartão: os mesmos dados, com a quantidade de compras no lugar delas (e
 * sem os estornos, já descontados do total, nem a lista de pagamentos).
 */
export type InvoiceSummary = Omit<Invoice, 'purchases' | 'refunds' | 'payments'> & {
  purchaseCount: number;
};

export function toInvoiceSummary(invoice: Invoice): InvoiceSummary {
  const { creditCardId, total, previousBalance, amountDue, paidAmount, balance } = invoice;
  const { referenceMonth, start, end, closingDate, dueDate, payment, status } = invoice;
  return {
    referenceMonth,
    start,
    end,
    closingDate,
    dueDate,
    creditCardId,
    total,
    previousBalance,
    amountDue,
    paidAmount,
    balance,
    payment,
    status,
    purchaseCount: invoice.purchases.length,
  };
}

/**
 * A compra pertence a uma fatura já paga, ou anterior a uma paga; é preciso desfazer o pagamento
 * antes de alterá-la.
 */
export class PaidInvoiceError extends Error {
  constructor() {
    super('The invoice of this purchase, or a later one, is already paid');
    this.name = 'PaidInvoiceError';
  }
}
