import { Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Ícone sobre a cor de identificação escolhida (contas, categorias etc.). */
@Component({
  imports: [MatIcon],
  selector: 'app-icon-avatar',
  template: `<mat-icon aria-hidden="true">{{ icon() }}</mat-icon>`,
  host: { '[style.--avatar-color]': 'color()' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--avatar-color);
      color: #fff;
    }
  `,
})
export class IconAvatar {
  readonly icon = input.required<string>();
  readonly color = input.required<string>();
}
