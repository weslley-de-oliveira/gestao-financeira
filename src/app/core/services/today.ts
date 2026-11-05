import { InjectionToken } from '@angular/core';

/**
 * Fonte da data atual; substituída nos testes para fixar o "hoje". Fica sem dependências para não
 * levar date-fns ao bundle inicial.
 */
export const TODAY = new InjectionToken<() => Date>('TODAY', {
  factory: () => () => new Date(),
});
