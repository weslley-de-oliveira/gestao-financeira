import { addMonths, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { DateRange } from '../models/period';
import { toIsoDate } from './date';

/** Mês sem dia: `yyyy-MM`. Pode ser comparado como texto. */
export type IsoMonth = string;

const ISO_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isIsoMonth(value: unknown): value is IsoMonth {
  return typeof value === 'string' && ISO_MONTH_PATTERN.test(value);
}

export function toIsoMonth(date: Date): IsoMonth {
  return format(date, 'yyyy-MM');
}

/** Primeiro dia do mês, no fuso local. */
function firstDay(month: IsoMonth): Date {
  const match = ISO_MONTH_PATTERN.exec(month);
  if (!match) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

/** "2026-11" → { start: "2026-11-01", end: "2026-11-30" }. */
export function monthRange(month: IsoMonth): DateRange {
  const first = firstDay(month);
  return { start: toIsoDate(first), end: toIsoDate(endOfMonth(first)) };
}

export function shiftMonth(month: IsoMonth, amount: number): IsoMonth {
  return toIsoMonth(addMonths(firstDay(month), amount));
}

/** "2026-11" → "novembro de 2026". */
export function formatMonth(month: IsoMonth): string {
  return format(firstDay(month), "MMMM 'de' yyyy", { locale: ptBR });
}
