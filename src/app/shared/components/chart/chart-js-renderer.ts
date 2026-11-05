import { Injectable } from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { ChartHandle, ChartRenderer, ChartSpec } from './chart-spec';

// Registra só o que os gráficos usam, mantendo o Chart.js fora do que não é necessário no bundle.
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);
Chart.defaults.font.family = 'Inter, sans-serif';

/** Converte uma variável CSS do tema na cor que o canvas entende. */
export type ColorResolver = (cssVariable: string) => string;

/** Configuração do Chart.js para a especificação, com marcas finas e eixos discretos. */
export function toChartConfiguration(
  spec: ChartSpec,
  color: ColorResolver,
  reducedMotion = false,
): ChartConfiguration {
  const text = color('--mat-sys-on-surface-variant');
  const grid = color('--mat-sys-outline-variant');
  const datasets = spec.series.map((series) => {
    const seriesColor = color(series.color);
    const data = [...series.values];
    return spec.type === 'bar'
      ? {
          label: series.label,
          data,
          backgroundColor: seriesColor,
          borderRadius: 4,
          borderSkipped: 'start' as const,
          maxBarThickness: 32,
        }
      : {
          label: series.label,
          data,
          borderColor: seriesColor,
          backgroundColor: seriesColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 12,
          tension: 0.25,
        };
  });

  return {
    type: spec.type,
    data: { labels: [...spec.labels], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reducedMotion ? false : undefined,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        // Uma série dispensa legenda: o título do gráfico já a identifica.
        legend: {
          display: spec.series.length > 1,
          position: 'bottom',
          labels: { color: text, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${spec.formatValue(item.parsed.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: grid },
          ticks: { color: text, maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          beginAtZero: spec.type === 'bar',
          grid: { color: grid },
          border: { display: false },
          ticks: {
            color: text,
            maxTicksLimit: 6,
            callback: (value) => (spec.formatTick ?? spec.formatValue)(Number(value)),
          },
        },
      },
    },
  };
}

/** Desenha os gráficos com o Chart.js, usando as cores do tema do Angular Material. */
@Injectable({ providedIn: 'root' })
export class ChartJsRenderer implements ChartRenderer {
  render(canvas: HTMLCanvasElement, spec: ChartSpec): ChartHandle {
    const resolve = themeColorResolver(canvas.parentElement ?? document.body);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chart = new Chart(canvas, toChartConfiguration(spec, resolve, reducedMotion));

    return {
      update: (next) => {
        const config = toChartConfiguration(next, resolve, reducedMotion);
        chart.data = config.data;
        chart.options = config.options ?? {};
        chart.update();
      },
      destroy: () => chart.destroy(),
    };
  }
}

/**
 * As variáveis do tema usam `light-dark()`, que o canvas não interpreta; um elemento de apoio
 * deixa o navegador resolver a cor final.
 */
function themeColorResolver(container: HTMLElement): ColorResolver {
  return (cssVariable) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${cssVariable})`;
    container.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };
}
