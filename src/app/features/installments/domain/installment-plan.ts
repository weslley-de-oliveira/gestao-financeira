import { addMonths } from 'date-fns';
import { CreditCard } from '../../../shared/models/credit-card';
import { IsoDate, parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { IsoMonth, shiftMonth } from '../../../shared/utils/month';
import { invoiceCycleFor, invoiceCycleForMonth } from '../../credit-cards/domain/invoice-cycle';

type CardDays = Pick<CreditCard, 'closingDay' | 'dueDay'>;

/** Parcelas de uma compra parcelada no cartão: de 2 a 24, como na API. */
export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 24;

/** Uma parcela planejada: número, valor, data e a fatura em que cai. */
export interface PlannedInstallment {
  installmentNumber: number;
  amount: Cents;
  date: IsoDate;
  referenceMonth: IsoMonth;
}

/**
 * Divide o total em parcelas iguais, em centavos; a sobra da divisão fica na primeira (R$ 100,00
 * em 3x: 33,34 + 33,33 + 33,33). O total precisa ter pelo menos 1 centavo por parcela. Mesma
 * regra da API (`installment-plan.ts`).
 */
export function splitAmount(total: Cents, count: number): Cents[] {
  if (!Number.isSafeInteger(count) || count < 1 || total < count) {
    throw new RangeError(`Cannot split ${total} into ${count} installments`);
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index === 0 ? remainder : 0));
}

/**
 * Datas das parcelas, uma por fatura seguida. A primeira é a data da compra; a parcela k fica na
 * fatura k − 1 meses depois da primeira, no mesmo dia da compra, ajustado para dentro do ciclo
 * dessa fatura (somar meses sem o ajuste erraria a fatura perto do fechamento e nos dias 29 a 31).
 */
export function installmentDates(
  card: CardDays,
  purchaseDate: IsoDate,
  count: number,
): { date: IsoDate; referenceMonth: IsoMonth }[] {
  const purchase = parseIsoDate(purchaseDate);
  if (!purchase) {
    throw new RangeError(`Invalid date: ${purchaseDate}`);
  }
  const first = invoiceCycleFor(card, purchaseDate);
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) {
      return { date: purchaseDate, referenceMonth: first.referenceMonth };
    }
    const cycle = invoiceCycleForMonth(card, shiftMonth(first.referenceMonth, index));
    const sameDay = toIsoDate(addMonths(purchase, index));
    const date = sameDay < cycle.start ? cycle.start : sameDay > cycle.end ? cycle.end : sameDay;
    return { date, referenceMonth: cycle.referenceMonth };
  });
}

/** As parcelas de uma compra de `amount` em `date`, no cartão, em `count` vezes. */
export function planInstallments(
  card: CardDays,
  purchase: { amount: Cents; date: IsoDate },
  count: number,
): PlannedInstallment[] {
  const amounts = splitAmount(purchase.amount, count);
  return installmentDates(card, purchase.date, count).map(({ date, referenceMonth }, index) => ({
    installmentNumber: index + 1,
    amount: amounts[index],
    date,
    referenceMonth,
  }));
}
