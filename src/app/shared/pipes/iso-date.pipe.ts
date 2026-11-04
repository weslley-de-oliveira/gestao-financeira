import { Pipe, PipeTransform } from '@angular/core';
import { IsoDate, formatIsoDate } from '../utils/date';

/**
 * Exibe datas `yyyy-MM-dd` no padrão brasileiro. Evita o `DatePipe`, que interpreta esse
 * formato como UTC e mostraria o dia anterior no fuso do Brasil.
 */
@Pipe({ name: 'isoDate' })
export class IsoDatePipe implements PipeTransform {
  transform(value: IsoDate): string {
    return formatIsoDate(value);
  }
}
