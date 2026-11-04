import { format, getDaysInMonth, subDays } from 'date-fns';
import { CreditCard, InvoiceCycle } from '../../../shared/models/credit-card';
import { IsoDate, parseIsoDate, toIsoDate } from '../../../shared/utils/date';

type CardDays = Pick<CreditCard, 'closingDay' | 'dueDay'>;

/**
 * Fatura em que cai uma compra feita em `date`. Regras:
 * - a fatura fecha no dia de fechamento; compras feitas nesse dia já vão para a fatura seguinte
 *   (o "melhor dia de compra");
 * - o vencimento é no mesmo mês do fechamento quando o dia de vencimento é maior que o de
 *   fechamento, senão no mês seguinte;
 * - dias que não existem no mês (29 a 31) viram o último dia do mês.
 */
export function invoiceCycleFor(card: CardDays, date: IsoDate): InvoiceCycle {
  const day = parseIsoDate(date);
  if (!day) {
    throw new RangeError(`Invalid date: ${date}`);
  }
  let closing = dayOfMonth(day.getFullYear(), day.getMonth(), card.closingDay);
  if (day >= closing) {
    closing = dayOfMonth(day.getFullYear(), day.getMonth() + 1, card.closingDay);
  }
  const previousClosing = dayOfMonth(
    closing.getFullYear(),
    closing.getMonth() - 1,
    card.closingDay,
  );
  const dueMonth = closing.getMonth() + (card.dueDay > card.closingDay ? 0 : 1);
  const due = dayOfMonth(closing.getFullYear(), dueMonth, card.dueDay);

  return {
    referenceMonth: format(due, 'yyyy-MM'),
    start: toIsoDate(previousClosing),
    end: toIsoDate(subDays(closing, 1)),
    closingDate: toIsoDate(closing),
    dueDate: toIsoDate(due),
  };
}

/** Dia `day` do mês, limitado ao último dia; `month` fora de 0–11 avança ou recua o ano. */
function dayOfMonth(year: number, month: number, day: number): Date {
  const first = new Date(year, month, 1);
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, getDaysInMonth(first)));
}
