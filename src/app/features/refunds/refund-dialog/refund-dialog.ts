import { Component, Injector, inject, signal } from '@angular/core';
import {
  FormField,
  ValidationError,
  form,
  maxLength,
  required,
  schema,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
  Transaction,
} from '../../../shared/models/transaction';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/date';
import { Cents, formatMoneyInput, parseMoney } from '../../../shared/utils/money';
import { PaidInvoiceError } from '../../invoices/domain/invoice-rules';
import {
  InvalidRefundInputError,
  RefundInput,
  defaultRefundDescription,
} from '../domain/refund-rules';
import { RefundsFacade } from '../refunds.facade';
import { unexpectedErrorMessage } from '../../../core/errors/unexpected-error-message';

export interface RefundDialogData {
  expense: Transaction;
  /** O estorno em edição; ausente ao registrar um novo. */
  refund?: Transaction;
  /** O que falta estornar da despesa, sem contar o estorno em edição. */
  remaining: Cents;
  today: Date;
}

interface Model {
  description: string;
  amount: string;
  date: Date | null;
  notes: string;
}

function refundSchema({ expense, remaining }: RefundDialogData) {
  return schema<Model>((p) => {
    required(p.description, { message: 'Informe a descrição.' });
    validate(p.description, ({ value }) =>
      value() && !value().trim() ? { kind: 'blank', message: 'Informe a descrição.' } : undefined,
    );
    maxLength(p.description, TRANSACTION_DESCRIPTION_MAX_LENGTH, {
      message: `A descrição deve ter no máximo ${TRANSACTION_DESCRIPTION_MAX_LENGTH} caracteres.`,
    });
    required(p.amount, { message: 'Informe o valor.' });
    validate(p.amount, ({ value }) => {
      const cents = value() ? parseMoney(value()) : null;
      if (cents === null) {
        return undefined;
      }
      if (cents <= 0) {
        return { kind: 'money', message: 'O valor deve ser maior que zero.' };
      }
      return cents > remaining
        ? { kind: 'remaining', message: remainingMessage(remaining) }
        : undefined;
    });
    required(p.date, { message: 'Informe a data.' });
    validate(p.date, ({ value }) => {
      const date = value();
      return date && toIsoDate(date) < expense.date
        ? { kind: 'beforeExpense', message: 'O estorno não pode ser anterior à despesa.' }
        : undefined;
    });
    maxLength(p.notes, TRANSACTION_NOTES_MAX_LENGTH, {
      message: `As observações devem ter no máximo ${TRANSACTION_NOTES_MAX_LENGTH} caracteres.`,
    });
  });
}

function remainingMessage(remaining: Cents): string {
  return `O estorno pode ser de no máximo R$ ${formatMoneyInput(remaining)}, o que falta estornar.`;
}

/**
 * Registro ou edição de um estorno: valor (padrão: o que falta estornar), data (padrão: hoje),
 * descrição e observações. Grava pela facade e fecha com o estorno salvo; recusas de valor, data
 * ou fatura paga ficam marcadas no campo, e o diálogo continua aberto.
 */
@Component({
  imports: [
    FormField,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MoneyMaskDirective,
  ],
  selector: 'app-refund-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.refund ? 'Editar estorno' : 'Registrar estorno' }}</h2>
    <form (submit)="save($event)">
      <mat-dialog-content>
        <p class="dialog__note">
          {{
            data.expense.creditCardId
              ? 'O estorno abate a fatura do cartão em que a data dele cai e libera o limite.'
              : 'O valor estornado volta para a conta da despesa.'
          }}
          Ele reduz o gasto da categoria no mês do estorno.
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
            [formField]="refundForm.amount"
          />
          <mat-hint>Falta estornar R$ {{ remainingText }}</mat-hint>
          @if (refundForm.amount().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Data</mat-label>
          <input matInput [matDatepicker]="picker" [min]="minDate" [formField]="refundForm.date" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (errorText(refundForm.date().errors(), 'Informe uma data válida.'); as error) {
            <mat-error>{{ error }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Descrição</mat-label>
          <input matInput autocomplete="off" [formField]="refundForm.description" />
          @if (refundForm.description().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Observações (opcional)</mat-label>
          <textarea matInput rows="2" [formField]="refundForm.notes"></textarea>
          @if (refundForm.notes().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
        @if (failure(); as failure) {
          <p class="dialog__failure" role="alert">{{ failure }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="refundForm().submitting()">
          {{ data.refund ? 'Salvar' : 'Estornar' }}
        </button>
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
    .dialog__failure {
      margin: 0;
      color: var(--mat-sys-error);
    }
  `,
})
export class RefundDialog {
  protected readonly data = inject<RefundDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RefundDialog, Transaction>>(MatDialogRef);
  private readonly facade = inject(RefundsFacade);
  protected readonly remainingText = formatMoneyInput(this.data.remaining);
  protected readonly minDate = parseIsoDate(this.data.expense.date);
  protected readonly failure = signal<string | null>(null);
  private readonly model = signal<Model>(
    this.data.refund
      ? {
          description: this.data.refund.description,
          amount: formatMoneyInput(this.data.refund.amount),
          date: parseIsoDate(this.data.refund.date),
          notes: this.data.refund.notes ?? '',
        }
      : {
          description: defaultRefundDescription(this.data.expense),
          amount: formatMoneyInput(this.data.remaining),
          date: this.data.today,
          notes: '',
        },
  );
  protected readonly refundForm = form(this.model, refundSchema(this.data));

  protected errorText(errors: readonly ValidationError[], fallback: string): string | null {
    const [error] = errors;
    return error ? (error.message ?? fallback) : null;
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.refundForm, async (field) => {
      const { description, amount, date, notes } = field().value();
      const cents = parseMoney(amount);
      if (cents === null || !date) {
        return undefined;
      }
      const input: RefundInput = {
        description,
        amount: cents,
        date: toIsoDate(date),
        notes: notes.trim() || null,
      };
      try {
        const saved = this.data.refund
          ? await this.facade.update(this.data.refund, input)
          : await this.facade.create(this.data.expense, input);
        this.dialogRef.close(saved);
      } catch (error) {
        if (error instanceof PaidInvoiceError) {
          return {
            kind: 'paidInvoice',
            message:
              'A fatura desta data já foi paga. Escolha uma data de fatura em aberto ou desfaça o pagamento.',
            fieldTree: field.date,
          };
        }
        if (error instanceof InvalidRefundInputError && error.field === 'amount') {
          return {
            kind: 'remaining',
            message: 'O valor passa do que falta estornar. Recarregue a página e confira.',
            fieldTree: field.amount,
          };
        }
        if (error instanceof InvalidRefundInputError && error.field === 'date') {
          return {
            kind: 'beforeExpense',
            message: 'O estorno não pode ser anterior à despesa.',
            fieldTree: field.date,
          };
        }
        this.failure.set(
          unexpectedErrorMessage('Não foi possível salvar o estorno. Tente novamente.', error),
        );
      }
      return undefined;
    });
  }
}

/** Abre o diálogo no injetor da tela (o datepicker usa o adaptador de datas da rota). */
export function openRefundDialog(
  dialog: MatDialog,
  injector: Injector,
  data: RefundDialogData,
): Observable<Transaction | undefined> {
  return dialog
    .open<RefundDialog, RefundDialogData, Transaction>(RefundDialog, {
      data,
      injector,
      width: '32rem',
      maxWidth: '95vw',
    })
    .afterClosed();
}
