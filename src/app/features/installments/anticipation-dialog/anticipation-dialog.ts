import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { IsoMonth, formatMonth } from '../../../shared/utils/month';
import { InstallmentPurchase } from '../domain/installment-rules';

export interface AnticipationDialogData {
  purchase: InstallmentPurchase;
  /** A fatura atual do cartão, para onde as parcelas vão. */
  invoiceMonth: IsoMonth;
}

/**
 * Antecipação de parcelas: quantas das últimas vão para a fatura atual (padrão: todas as
 * possíveis). Fecha com o número escolhido, ou sem valor ao cancelar.
 */
@Component({
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  selector: 'app-anticipation-dialog',
  template: `
    <h2 mat-dialog-title>Antecipar parcelas</h2>
    <form (submit)="save($event)">
      <mat-dialog-content>
        <p class="dialog__note">
          As últimas parcelas vão para a fatura de {{ invoiceLabel }}, com a data de hoje. Número e
          valor de cada uma não mudam.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Parcelas a antecipar</mat-label>
          <mat-select [value]="count()" (valueChange)="count.set($event)">
            @for (option of options; track option) {
              <mat-option [value]="option">
                {{ option === 1 ? 'A última parcela' : 'As últimas ' + option + ' parcelas' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        <p class="dialog__note">
          Se o banco der desconto pela antecipação, registre-o como estorno da parcela antecipada.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit">Antecipar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: grid;
      gap: 4px;
    }
    .dialog__note {
      margin: 0 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AnticipationDialog {
  protected readonly data = inject<AnticipationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AnticipationDialog, number>>(MatDialogRef);
  protected readonly options = Array.from(
    { length: this.data.purchase.anticipatableCount },
    (_, index) => index + 1,
  );
  protected readonly count = signal(this.data.purchase.anticipatableCount);
  protected readonly invoiceLabel = formatMonth(this.data.invoiceMonth);

  protected save(event: Event): void {
    event.preventDefault();
    this.dialogRef.close(this.count());
  }
}

export function openAnticipationDialog(
  dialog: MatDialog,
  data: AnticipationDialogData,
): Observable<number | undefined> {
  return dialog
    .open<AnticipationDialog, AnticipationDialogData, number>(AnticipationDialog, {
      data,
      width: '28rem',
      maxWidth: '95vw',
    })
    .afterClosed();
}
