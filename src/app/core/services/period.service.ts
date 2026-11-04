import { Injectable, signal } from '@angular/core';
import { PeriodPreset } from '../../shared/models/period';

/** Período global selecionado na topbar, consumido pelas telas que filtram por data. */
@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly _selected = signal<PeriodPreset>('current-month');

  readonly selected = this._selected.asReadonly();

  select(period: PeriodPreset): void {
    this._selected.set(period);
  }
}
