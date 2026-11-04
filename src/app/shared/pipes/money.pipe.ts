import { DEFAULT_CURRENCY_CODE, LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { Cents } from '../utils/money';

/** Exibe centavos inteiros na moeda e no locale da aplicação: 123456 → "R$ 1.234,56". */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly format = new Intl.NumberFormat(inject(LOCALE_ID), {
    style: 'currency',
    currency: inject(DEFAULT_CURRENCY_CODE),
  });

  transform(cents: Cents): string {
    return this.format.format(cents / 100);
  }
}
