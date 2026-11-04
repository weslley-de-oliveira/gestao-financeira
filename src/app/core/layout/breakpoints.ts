import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

// Mantenha em sincronia com src/styles/_breakpoints.scss.
export const MOBILE_MEDIA_QUERY = '(max-width: 767.98px)';

/** Sinal que indica layout mobile. Deve ser chamado em contexto de injeção. */
export function injectIsMobile(): Signal<boolean> {
  return toSignal(
    inject(BreakpointObserver)
      .observe(MOBILE_MEDIA_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}
