import { isInRange } from '../../../shared/models/period';
import { CreditCard, CreditCardWithUsage } from '../../../shared/models/credit-card';
import { Transaction } from '../../../shared/models/transaction';
import { IsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { invoiceCycleFor } from './invoice-cycle';

type Purchase = Pick<Transaction, 'amount' | 'date' | 'creditCardId'>;

/**
 * Limite e próxima fatura de um cartão, pela regra única:
 * - utilizado = compras ainda não pagas (os pagamentos de fatura entram com as Faturas);
 * - disponível = limite − utilizado, negativo se o limite foi ultrapassado;
 * - próxima fatura = a aberta em `today`, com as compras já lançadas nela.
 */
export function calculateCardUsage(
  card: CreditCard,
  transactions: readonly Purchase[],
  today: IsoDate,
): CreditCardWithUsage {
  const purchases = transactions.filter((transaction) => transaction.creditCardId === card.id);
  const usedLimit = sum(purchases);
  const cycle = invoiceCycleFor(card, today);
  return {
    ...card,
    usedLimit,
    availableLimit: card.creditLimit - usedLimit,
    nextInvoice: {
      ...cycle,
      amount: sum(purchases.filter((purchase) => isInRange(purchase.date, cycle))),
    },
  };
}

/** Percentual do limite utilizado, de 0 a 100 (limitado), para barras de progresso. */
export function usagePercent(card: Pick<CreditCardWithUsage, 'creditLimit' | 'usedLimit'>): number {
  if (card.creditLimit <= 0) {
    return card.usedLimit > 0 ? 100 : 0;
  }
  return Math.min(100, Math.max(0, Math.round((card.usedLimit / card.creditLimit) * 100)));
}

function sum(purchases: readonly Pick<Purchase, 'amount'>[]): Cents {
  return purchases.reduce((total, purchase) => total + purchase.amount, 0);
}
