import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Página provisória das rotas cujas telas ainda não foram implementadas. */
@Component({
  selector: 'app-page-placeholder',
  template: `
    <section>
      <h1>{{ title }}</h1>
      <p>Esta tela ainda será implementada.</p>
    </section>
  `,
  styles: `
    h1 {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-headline-small);
    }

    p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class PagePlaceholder {
  protected readonly title = inject(ActivatedRoute).snapshot.title ?? '';
}
