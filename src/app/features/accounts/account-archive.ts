import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { Account, AccountWithBalance } from '../../shared/models/account';
import { AccountsFacade } from './accounts.facade';
import { unexpectedErrorMessage } from '../../core/errors/unexpected-error-message';

/** Fluxo de arquivar/reativar com confirmação, compartilhado pela listagem e pelo detalhe. */
@Injectable({ providedIn: 'root' })
export class AccountArchiveAction {
  private readonly facade = inject(AccountsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Retorna a conta atualizada, ou `null` se a pessoa cancelar ou a operação falhar. */
  async toggle(account: Account): Promise<AccountWithBalance | null> {
    const archive = !account.isArchived;
    const confirmed = await firstValueFrom(
      openConfirmDialog(
        this.dialog,
        archive
          ? {
              title: `Arquivar "${account.name}"?`,
              message:
                'A conta deixa de aparecer entre as ativas e não entra no saldo total. O histórico é preservado e você pode reativá-la quando quiser.',
              confirmLabel: 'Arquivar',
            }
          : {
              title: `Reativar "${account.name}"?`,
              message: 'A conta volta a aparecer entre as ativas e a compor o saldo total.',
              confirmLabel: 'Reativar',
            },
      ),
    );
    if (!confirmed) {
      return null;
    }

    try {
      const updated = await this.facade.setArchived(account.id, archive);
      this.snackBar.open(archive ? 'Conta arquivada.' : 'Conta reativada.', 'Fechar', {
        duration: 4000,
      });
      return updated;
    } catch (error) {
      this.snackBar.open(
        unexpectedErrorMessage('Não foi possível atualizar a conta. Tente novamente.', error),
        'Fechar',
        {
          duration: 5000,
        },
      );
      return null;
    }
  }
}
