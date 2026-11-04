import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { PreferencesService } from '../../../core/preferences/preferences.service';
import { CHART_RENDERER, ChartHandle, ChartSpec } from './chart-spec';

/**
 * Gráfico desenhado em canvas. O canvas fica oculto para leitores de tela, que recebem uma
 * tabela equivalente com os mesmos valores.
 */
@Component({
  selector: 'app-chart',
  template: `
    <div class="chart__canvas">
      <canvas #canvas aria-hidden="true"></canvas>
    </div>
    <table class="visually-hidden">
      <caption [textContent]="label()"></caption>
      <thead>
        <tr>
          <th scope="col">{{ categoryLabel() }}</th>
          @for (series of spec().series; track series.label) {
            <th scope="col">{{ series.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (category of spec().labels; track $index; let index = $index) {
          <tr>
            <th scope="row">{{ category }}</th>
            @for (series of spec().series; track series.label) {
              <td>{{ spec().formatValue(series.values[index]) }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
    }

    .chart__canvas {
      position: relative;
      height: var(--chart-height, 16rem);
    }
  `,
})
export class ChartView {
  readonly spec = input.required<ChartSpec>();
  /** Nome acessível do gráfico, usado como legenda da tabela equivalente. */
  readonly label = input.required<string>();
  /** Cabeçalho da coluna das categorias na tabela equivalente. */
  readonly categoryLabel = input('Período');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly renderer = inject(CHART_RENDERER);
  private readonly preferences = inject(PreferencesService);
  private handle?: ChartHandle;

  constructor() {
    afterRenderEffect({
      write: () => {
        const spec = this.spec();
        // O canvas guarda as cores já resolvidas: ao trocar o tema, o gráfico é redesenhado.
        this.preferences.effectiveTheme();
        if (this.handle) {
          this.handle.update(spec);
        } else {
          this.handle = this.renderer.render(this.canvas().nativeElement, spec);
        }
      },
    });
    inject(DestroyRef).onDestroy(() => this.handle?.destroy());
  }
}
