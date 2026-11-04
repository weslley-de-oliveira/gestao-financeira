import { toChartConfiguration } from './chart-js-renderer';
import { ChartSpec } from './chart-spec';

const resolve = (variable: string) => `color(${variable})`;

const spec: ChartSpec = {
  type: 'bar',
  labels: ['set/26', 'out/26'],
  series: [
    { label: 'Receitas', values: [500_000, 0], color: '--mat-sys-primary' },
    { label: 'Despesas', values: [25_090, 1_000], color: '--mat-sys-error' },
  ],
  formatValue: (value) => `R$ ${value / 100}`,
  formatTick: (value) => `${value / 100}`,
};

describe('toChartConfiguration', () => {
  it('maps the series to datasets with the theme colors', () => {
    const config = toChartConfiguration(spec, resolve);

    expect(config.type).toBe('bar');
    expect(config.data.labels).toEqual(['set/26', 'out/26']);
    expect(config.data.datasets).toMatchObject([
      { label: 'Receitas', data: [500_000, 0], backgroundColor: 'color(--mat-sys-primary)' },
      { label: 'Despesas', data: [25_090, 1_000], backgroundColor: 'color(--mat-sys-error)' },
    ]);
  });

  it('shows the legend only for more than one series', () => {
    const single = { ...spec, type: 'line' as const, series: spec.series.slice(0, 1) };

    expect(toChartConfiguration(spec, resolve).options?.plugins?.legend?.display).toBe(true);
    expect(toChartConfiguration(single, resolve).options?.plugins?.legend?.display).toBe(false);
  });

  it('formats the axis with the short format', () => {
    const ticks = toChartConfiguration(spec, resolve).options?.scales?.['y']?.ticks;
    const callback = ticks?.callback as (value: number) => string;

    expect(callback.call(null, 150_000)).toBe('1500');
  });

  it('disables animations when the user prefers reduced motion', () => {
    expect(toChartConfiguration(spec, resolve, true).options?.animation).toBe(false);
  });
});
