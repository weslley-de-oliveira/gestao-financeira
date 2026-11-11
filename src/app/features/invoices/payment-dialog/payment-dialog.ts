import { Component, inject, signal } from '@angular/core';
import { FormField, form, required, schema, submit, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { IsoDate } from '../../../shared/utils/date';
import { Cents, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { IsoMonth } from '../../../shared/utils/month';
import { monthLabel } from '../invoices.facade';

export interface PaymentDialogData {
  /** Fatura paga ("12/2026" no título). */
  referenceMonth: IsoMonth;
  /** O que falta pagar: o valor padrão e o máximo. */
  balance: Cents;
  /** Conta de pagamento do cartão, de onde o valor sai. */
  accountName: string;
  /** A fatura seguinte e o fechamento dela, quando o restante passa para ela. */
  nextMonth: IsoMonth;
  nextClosingDate: IsoDate;
}

interface Model {
  amount: string;
}

function paymentSchema({ balance }: PaymentDialogData) {
  return schema<Model>((p) => {
    required(p.amount, { message: 'Informe o valor.' });
    validate(p.amount, ({ value }) => {
      const cents = value() ? parseMoney(value()) : null;
      if (cents === null) {
        return undefined;
      }
      if (cents <= 0) {
        return { kind: 'money', message: 'O valor deve ser maior que zero.' };
      }
      return cents > balance
        ? {
            kind: 'balance',
            message: `O pagamento pode ser de no máximo R$ ${formatMoneyInput(balance)}, o saldo da fatura.`,
          }
        : undefined;
    });
  });
}

/**
 * Pagamento de uma fatura, inteira ou em parte: o valor (padrão e máximo: o saldo) sai hoje da
 * conta de pagamento do cartão. Fecha com o valor em centavos, ou sem valor ao cancelar.
 */
@Component({
  imports: [
    FormField,
    IsoDatePipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MoneyMaskDirective,
  ],
  selector: 'app-payment-dialog',
  template: `
    <h2 mat-dialog-title>Pagar a fatura {{ monthText }}</h2>
    <form (submit)="save($event)">
      <mat-dialog-content>
        <p class="dialog__note">
          O valor sai hoje da conta {{ data.accountName }}. O pagamento não entra como despesa: as
          compras já foram contadas.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Valor</mat-label>
          <span matTextPrefix>R$&nbsp;</span>
          <input
            matInput
            appMoneyMask
            [allowNegative]="false"
            inputmode="numeric"
            autocomplete="off"
            [formField]="paymentForm.amount"
          />
          <mat-hint>Saldo da fatura: R$ {{ balanceText }}</mat-hint>
          @if (paymentForm.amount().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
        <p class="dialog__note">
          Pagando menos que o saldo, o restante passa para a fatura de {{ nextMonthText }} no
          fechamento dela, em {{ data.nextClosingDate | isoDate }}. Juros, IOF e multa do banco não
          são calculados: lance-os como uma compra no cartão.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit">Pagar</button>
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
export class PaymentDialog {
  protected readonly data = inject<PaymentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PaymentDialog, Cents>>(MatDialogRef);
  protected readonly monthText = monthLabel(this.data.referenceMonth);
  protected readonly nextMonthText = monthLabel(this.data.nextMonth);
  protected readonly balanceText = formatMoneyInput(this.data.balance);
  private readonly model = signal<Model>({ amount: this.balanceText });
  protected readonly paymentForm = form(this.model, paymentSchema(this.data));

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.paymentForm, async (field) => {
      const cents = parseMoney(field().value().amount);
      if (cents !== null) {
        this.dialogRef.close(cents);
      }
      return undefined;
    });
  }
}

export function openPaymentDialog(
  dialog: MatDialog,
  data: PaymentDialogData,
): Observable<Cents | undefined> {
  return dialog
    .open<PaymentDialog, PaymentDialogData, Cents>(PaymentDialog, {
      data,
      width: '28rem',
      maxWidth: '95vw',
    })
    .afterClosed();
}
