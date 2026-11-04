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
