import { isInRange } from '../../../shared/models/period';
import { CreditCard, CreditCardWithUsage } from '../../../shared/models/credit-card';
import {
  Transaction,
  isCardPurchase,
  isCardRefund,
  isInvoicePayment,
} from '../../../shared/models/transaction';
import { IsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { invoiceCycleFor } from './invoice-cycle';

type CardMovement = Pick<Transaction, 'type' | 'amount' | 'date' | 'creditCardId'>;

/**
 * Limite e próxima fatura de um cartão, pela regra única:
 * - utilizado = compras − estornos − faturas pagas (nunca negativo);
 * - disponível = limite − utilizado, negativo se o limite foi ultrapassado;
 * - próxima fatura = a aberta em `today`, com as compras menos os estornos já lançados nela.
 */
export function calculateCardUsage(
  card: CreditCard,
  transactions: readonly CardMovement[],
  today: IsoDate,
): CreditCardWithUsage {
  const ofCard = transactions.filter((transaction) => transaction.creditCardId === card.id);
  const purchases = ofCard.filter(isCardPurchase);
  const refunds = ofCard.filter(isCardRefund);
  const usedLimit = Math.max(
    0,
    sum(purchases) - sum(refunds) - sum(ofCard.filter(isInvoicePayment)),
  );
  const cycle = invoiceCycleFor(card, today);
  const inCycle = (movement: CardMovement) => isInRange(movement.date, cycle);
  return {
    ...card,
    usedLimit,
    availableLimit: card.creditLimit - usedLimit,
    nextInvoice: {
      ...cycle,
      amount: sum(purchases.filter(inCycle)) - sum(refunds.filter(inCycle)),
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

function sum(movements: readonly Pick<CardMovement, 'amount'>[]): Cents {
  return movements.reduce((total, movement) => total + movement.amount, 0);
}
