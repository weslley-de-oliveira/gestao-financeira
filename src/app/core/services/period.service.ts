import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { DateRange, PeriodPreset, periodRange } from '../../shared/models/period';

/** Fonte da data atual; substituída nos testes para fixar o "hoje". */
export const TODAY = new InjectionToken<() => Date>('TODAY', {
  factory: () => () => new Date(),
});

/** Período global selecionado na topbar, consumido pelas telas que filtram por data. */
@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly today = inject(TODAY);
  private readonly _selected = signal<PeriodPreset>('current-month');

  readonly selected = this._selected.asReadonly();
  /** Intervalo de datas do período selecionado. */
  readonly range = computed<DateRange>(() => periodRange(this._selected(), this.today()));

  select(period: PeriodPreset): void {
    this._selected.set(period);
  }
}
