import { Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Ícone da conta sobre a cor de identificação escolhida. */
@Component({
  imports: [MatIcon],
  selector: 'app-account-avatar',
  template: `<mat-icon aria-hidden="true">{{ icon() }}</mat-icon>`,
  host: { '[style.--account-color]': 'color()' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--mat-sys-corner-full);
      background: var(--account-color);
      color: #fff;
    }
  `,
})
export class AccountAvatar {
  readonly icon = input.required<string>();
  readonly color = input.required<string>();
}
