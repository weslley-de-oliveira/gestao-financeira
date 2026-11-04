import { Provider } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { ptBR } from 'date-fns/locale/pt-BR';
import { PtBrPaginatorIntl } from './pt-br-paginator-intl';

/**
 * Datepicker (date-fns, formato dd/MM/yyyy) e paginator em pt-BR. Registrado nas rotas das
 * features que usam esses componentes, e não em `app.config.ts`, para não levar o Material
 * para o bundle inicial.
 */
export function provideMaterialI18n(): Provider[] {
  return [
    provideDateFnsAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: ptBR },
    { provide: MatPaginatorIntl, useClass: PtBrPaginatorIntl },
  ];
}
