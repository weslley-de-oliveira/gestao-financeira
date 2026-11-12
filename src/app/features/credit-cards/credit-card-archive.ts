import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { CreditCard, CreditCardWithUsage } from '../../shared/models/credit-card';
import { CreditCardsFacade } from './credit-cards.facade';
import { unexpectedErrorMessage } from '../../core/errors/unexpected-error-message';

/** Fluxo de arquivar/reativar com confirmação, compartilhado pela listagem e pelo detalhe. */
@Injectable({ providedIn: 'root' })
export class CreditCardArchiveAction {
  private readonly facade = inject(CreditCardsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Retorna o cartão atualizado, ou `null` se a pessoa cancelar ou a operação falhar. */
  async toggle(card: CreditCard): Promise<CreditCardWithUsage | null> {
    const archive = !card.isArchived;
    const confirmed = await firstValueFrom(
      openConfirmDialog(
        this.dialog,
        archive
          ? {
              title: `Arquivar "${card.name}"?`,
              message:
                'O cartão deixa de aparecer entre os ativos e não aceita novas compras. As compras e o histórico são preservados e você pode reativá-lo quando quiser.',
              confirmLabel: 'Arquivar',
            }
          : {
              title: `Reativar "${card.name}"?`,
              message: 'O cartão volta a aparecer entre os ativos e a aceitar novas compras.',
              confirmLabel: 'Reativar',
            },
      ),
    );
    if (!confirmed) {
      return null;
    }

    try {
      const updated = await this.facade.setArchived(card.id, archive);
      this.snackBar.open(archive ? 'Cartão arquivado.' : 'Cartão reativado.', 'Fechar', {
        duration: 4000,
      });
      return updated;
    } catch (error) {
      this.snackBar.open(
        unexpectedErrorMessage('Não foi possível atualizar o cartão. Tente novamente.', error),
        'Fechar',
        {
          duration: 5000,
        },
      );
      return null;
    }
  }
}
