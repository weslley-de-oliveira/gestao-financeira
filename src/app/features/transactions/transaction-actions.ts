import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { Transaction, isInvoicePayment } from '../../shared/models/transaction';
import { HasRefundsError, PaidInvoiceError, TransactionsFacade } from './transactions.facade';
import { unexpectedErrorMessage } from '../../core/errors/unexpected-error-message';

export const PAID_INVOICE_MESSAGE =
  'A fatura desta compra já foi paga. Desfaça o pagamento na tela de Faturas para alterá-la.';

export const HAS_REFUNDS_MESSAGE =
  'Esta despesa tem estornos: exclua os estornos, no detalhe dela, antes de excluí-la ou de mudar valor, data, conta, cartão, tipo ou status.';

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
    } catch (error) {
      this.notify(
        error instanceof HasRefundsError
          ? HAS_REFUNDS_MESSAGE
          : unexpectedErrorMessage(
              'Não foi possível atualizar a transação. Tente novamente.',
              error,
            ),
      );
      return null;
    }
  }

  /**
   * Exclui após confirmação. Excluir um pagamento de fatura desfaz o pagamento. Retorna `true` se
   * a transação foi excluída.
   */
  async delete(transaction: Transaction): Promise<boolean> {
    const payment = isInvoicePayment(transaction);
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Excluir "${transaction.description}"?`,
        message: payment
          ? 'O pagamento será desfeito: o valor volta para a conta e a fatura volta a ficar em aberto.'
          : 'A transação será excluída definitivamente e o saldo da conta será recalculado. Esta ação não pode ser desfeita.',
        confirmLabel: 'Excluir',
      }),
    );
    if (!confirmed) {
      return false;
    }
    try {
      await this.facade.delete(transaction.id);
      this.notify(payment ? 'Pagamento desfeito.' : 'Transação excluída.');
      return true;
    } catch (error) {
      this.notify(
        error instanceof PaidInvoiceError
          ? PAID_INVOICE_MESSAGE
          : error instanceof HasRefundsError
            ? HAS_REFUNDS_MESSAGE
            : unexpectedErrorMessage(
                'Não foi possível excluir a transação. Tente novamente.',
                error,
              ),
      );
      return false;
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000 });
  }
}
