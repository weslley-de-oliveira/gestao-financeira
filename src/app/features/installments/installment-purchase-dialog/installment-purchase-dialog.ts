import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  required,
  schema,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { Category } from '../../../shared/models/category';
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  TRANSACTION_NOTES_MAX_LENGTH,
} from '../../../shared/models/transaction';
import { InstallmentPurchase, InstallmentPurchaseChanges } from '../domain/installment-rules';

export interface InstallmentPurchaseDialogData {
  purchase: InstallmentPurchase;
  /** Categorias de despesa ativas, mais a atual da compra (mesmo se arquivada). */
  categories: readonly Category[];
}

interface Model {
  description: string;
  categoryId: string;
  notes: string;
}

const purchaseSchema = schema<Model>((p) => {
  required(p.description, { message: 'Informe a descrição.' });
  validate(p.description, ({ value }) =>
    value() && !value().trim() ? { kind: 'blank', message: 'Informe a descrição.' } : undefined,
  );
  maxLength(p.description, TRANSACTION_DESCRIPTION_MAX_LENGTH, {
    message: `A descrição deve ter no máximo ${TRANSACTION_DESCRIPTION_MAX_LENGTH} caracteres.`,
  });
  required(p.categoryId, { message: 'Selecione a categoria.' });
  maxLength(p.notes, TRANSACTION_NOTES_MAX_LENGTH, {
    message: `As observações devem ter no máximo ${TRANSACTION_NOTES_MAX_LENGTH} caracteres.`,
  });
});

/**
 * Edição da compra parcelada: descrição, categoria e observações valem para todas as parcelas.
 * Fecha com as alterações, ou sem valor ao cancelar.
 */
@Component({
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  selector: 'app-installment-purchase-dialog',
  template: `
    <h2 mat-dialog-title>Editar a compra parcelada</h2>
    <form (submit)="save($event)">
      <mat-dialog-content>
        <p class="dialog__note">
          As alterações valem para as {{ data.purchase.installmentCount }} parcelas. Valor, número
          de parcelas, cartão e data não mudam: para isso, exclua a compra e registre de novo.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Descrição</mat-label>
          <input matInput [formField]="purchaseForm.description" />
          @if (purchaseForm.description().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Categoria</mat-label>
          <mat-select [formField]="purchaseForm.categoryId">
            @for (category of data.categories; track category.id) {
              <mat-option [value]="category.id">
                {{ category.name }}{{ category.isArchived ? ' (arquivada)' : '' }}
              </mat-option>
            }
          </mat-select>
          @if (purchaseForm.categoryId().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Observações</mat-label>
          <textarea matInput rows="3" [formField]="purchaseForm.notes"></textarea>
          @if (purchaseForm.notes().errors()[0]; as error) {
            <mat-error>{{ error.message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit">Salvar</button>
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
export class InstallmentPurchaseDialog {
  protected readonly data = inject<InstallmentPurchaseDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<InstallmentPurchaseDialog, InstallmentPurchaseChanges>>(MatDialogRef);
  private readonly model = signal<Model>({
    description: this.data.purchase.description,
    categoryId: this.data.purchase.categoryId,
    notes: this.data.purchase.notes ?? '',
  });
  protected readonly purchaseForm = form(this.model, purchaseSchema);

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.purchaseForm, async (field) => {
      const { description, categoryId, notes } = field().value();
      this.dialogRef.close({ description, categoryId, notes: notes.trim() || null });
      return undefined;
    });
  }
}

export function openInstallmentPurchaseDialog(
  dialog: MatDialog,
  data: InstallmentPurchaseDialogData,
): Observable<InstallmentPurchaseChanges | undefined> {
  return dialog
    .open<InstallmentPurchaseDialog, InstallmentPurchaseDialogData, InstallmentPurchaseChanges>(
      InstallmentPurchaseDialog,
      { data, width: '32rem', maxWidth: '95vw' },
    )
    .afterClosed();
}
