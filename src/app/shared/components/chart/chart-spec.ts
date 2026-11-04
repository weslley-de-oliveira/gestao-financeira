import { InjectionToken, inject } from '@angular/core';
import { ChartJsRenderer } from './chart-js-renderer';

export type ChartType = 'bar' | 'line';

export interface ChartSeries {
  label: string;
  values: readonly number[];
  /** Variável CSS do tema com a cor da série, ex.: `--chart-income` (definidas em `styles.scss`). */
  color: string;
}

/** Descrição do gráfico independente da biblioteca que o desenha. */
export interface ChartSpec {
  type: ChartType;
  labels: readonly string[];
  series: readonly ChartSeries[];
  /** Formata valores no tooltip e na tabela acessível. */
  formatValue: (value: number) => string;
  /** Formato mais curto para o eixo; padrão: `formatValue`. */
  formatTick?: (value: number) => string;
}

export interface ChartHandle {
  update(spec: ChartSpec): void;
  destroy(): void;
}

export interface ChartRenderer {
  render(canvas: HTMLCanvasElement, spec: ChartSpec): ChartHandle;
}

/** Quem desenha os gráficos; os testes trocam o Chart.js por um registro em memória. */
export const CHART_RENDERER = new InjectionToken<ChartRenderer>('CHART_RENDERER', {
  factory: () => inject(ChartJsRenderer),
});
