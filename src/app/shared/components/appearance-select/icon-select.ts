import { Component, computed, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { AppearanceOption } from '../../models/appearance';

/** Seletor de ícone (Material Symbols) a partir de uma lista fixa. Usar com `[formField]`. */
@Component({
  imports: [MatFormFieldModule, MatIcon, MatSelectModule],
  selector: 'app-icon-select',
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
            <mat-icon aria-hidden="true">{{ value() }}</mat-icon>
            {{ selected()?.label }}
          </span>
        </mat-select-trigger>
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value">
            <mat-icon aria-hidden="true">{{ option.value }}</mat-icon>
            {{ option.label }}
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styleUrl: './appearance-select.scss',
})
export class IconSelect implements FormValueControl<string> {
  readonly value = model('');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly label = input('Ícone');
  readonly options = input.required<readonly AppearanceOption[]>();

  protected readonly selected = computed(() =>
    this.options().find((option) => option.value === this.value()),
  );
}
