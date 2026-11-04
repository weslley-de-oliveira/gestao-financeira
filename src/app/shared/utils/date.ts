import { format, isValid, parse } from 'date-fns';

/**
 * Datas sem horário circulam como texto `yyyy-MM-dd`, interpretado no fuso local. Evita o
 * deslocamento de um dia que `new Date('2026-01-31')` (UTC) causaria no Brasil.
 */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

/** Retorna `null` se o texto não for uma data `yyyy-MM-dd` existente. */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }
  const date = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(date) && toIsoDate(date) === value ? date : null;
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && parseIsoDate(value) !== null;
}

/** "2026-11-04" → "04/11/2026". */
export function formatIsoDate(value: IsoDate): string {
  const date = parseIsoDate(value);
  return date ? format(date, 'dd/MM/yyyy') : value;
}
