import { Injectable } from '@angular/core';
import { ChartHandle, ChartRenderer, ChartSpec } from '../app/shared/components/chart/chart-spec';

/** Substitui o Chart.js nos testes (o jsdom não tem canvas) e guarda o que seria desenhado. */
@Injectable()
export class FakeChartRenderer implements ChartRenderer {
  private readonly active: { spec: ChartSpec }[] = [];

  /** Especificação atual de cada gráfico ativo, na ordem em que foram criados. */
  get charts(): ChartSpec[] {
    return this.active.map((chart) => chart.spec);
  }

  render(_canvas: HTMLCanvasElement, spec: ChartSpec): ChartHandle {
    const chart = { spec };
    this.active.push(chart);
    return {
      update: (next) => (chart.spec = next),
      destroy: () => this.active.splice(this.active.indexOf(chart), 1),
    };
  }
}
