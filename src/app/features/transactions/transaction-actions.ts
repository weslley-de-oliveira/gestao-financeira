import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { Transaction } from '../../shared/models/transaction';
import { TransactionsFacade } from './transactions.facade';

/** Ações sobre uma transação com feedback, compartilhadas pela listagem e pelo detalhe. */
@Injectable({ providedIn: 'root' })
export class TransactionActions {
  private readonly facade = inject(TransactionsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Alterna entre realizada e pendente. Retorna a transação atualizada, ou `null` se falhar. */
  async toggleStatus(transaction: Transaction): Promise<Transaction | null> {
    const status = transaction.status === 'pending' ? 'completed' : 'pending';
    try {
      const updated = await this.facade.setStatus(transaction.id, status);
      this.notify(
        status === 'completed'
          ? 'Transação marcada como realizada.'
          : 'Transação marcada como pendente.',
      );
      return updated;
    } catch {
      this.notify('Não foi possível atualizar a transação. Tente novamente.');
      return null;
    }
  }

  /** Exclui após confirmação. Retorna `true` se a transação foi excluída. */
  async delete(transaction: Transaction): Promise<boolean> {
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Excluir "${transaction.description}"?`,
        message:
          'A transação será excluída definitivamente e o saldo da conta será recalculado. Esta ação não pode ser desfeita.',
        confirmLabel: 'Excluir',
      }),
    );
    if (!confirmed) {
      return false;
    }
    try {
      await this.facade.delete(transaction.id);
      this.notify('Transação excluída.');
      return true;
    } catch {
      this.notify('Não foi possível excluir a transação. Tente novamente.');
      return false;
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000 });
  }
}
