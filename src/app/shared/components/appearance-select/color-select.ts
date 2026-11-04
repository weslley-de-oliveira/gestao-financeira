import { Component, computed, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { APPEARANCE_COLORS, AppearanceOption } from '../../models/appearance';

/** Seletor de cor de identificação. Usar com `[formField]`. */
@Component({
  imports: [MatFormFieldModule, MatSelectModule],
  selector: 'app-color-select',
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ label() }}</mat-label>
      <mat-select
        [value]="value()"
        [disabled]="disabled()"
        (valueChange)="value.set($event)"
        (closed)="touched.set(true)"
      >
        <mat-select-trigger>
          <span class="appearance-option">
            <span
              class="appearance-option__swatch"
              aria-hidden="true"
              [style.background]="value()"
            ></span>
            {{ selected()?.label }}
          </span>
        </mat-select-trigger>
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value">
            <span class="appearance-option">
              <span
                class="appearance-option__swatch"
                aria-hidden="true"
                [style.background]="option.value"
              ></span>
              {{ option.label }}
            </span>
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styleUrl: './appearance-select.scss',
})
export class ColorSelect implements FormValueControl<string> {
  readonly value = model('');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly label = input('Cor');
  readonly options = input<readonly AppearanceOption[]>(APPEARANCE_COLORS);

  protected readonly selected = computed(() =>
    this.options().find((option) => option.value === this.value()),
  );
}
