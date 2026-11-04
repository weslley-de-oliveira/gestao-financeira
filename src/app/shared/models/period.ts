import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { IsoDate, toIsoDate } from '../utils/date';

export type PeriodPreset = 'current-month' | 'previous-month' | 'last-3-months';

export interface PeriodOption {
  value: PeriodPreset;
  label: string;
}

export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { value: 'current-month', label: 'Mês atual' },
  { value: 'previous-month', label: 'Mês anterior' },
  { value: 'last-3-months', label: 'Últimos 3 meses' },
];

/** Intervalo fechado de datas (`start` e `end` inclusive). */
export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

export function periodRange(preset: PeriodPreset, today: Date): DateRange {
  switch (preset) {
    case 'current-month':
      return monthRange(today, today);
    case 'previous-month': {
      const previous = subMonths(today, 1);
      return monthRange(previous, previous);
    }
    case 'last-3-months':
      // O mês atual e os dois anteriores.
      return monthRange(subMonths(today, 2), today);
  }
}

export function isInRange(date: IsoDate, range: DateRange): boolean {
  // Datas `yyyy-MM-dd` podem ser comparadas como texto.
  return date >= range.start && date <= range.end;
}

function monthRange(first: Date, last: Date): DateRange {
  return { start: toIsoDate(startOfMonth(first)), end: toIsoDate(endOfMonth(last)) };
}
