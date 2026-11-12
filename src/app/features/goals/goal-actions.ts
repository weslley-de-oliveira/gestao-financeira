import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { Goal, GoalWithProgress } from '../../shared/models/goal';
import { GoalsFacade } from './goals.facade';
import { unexpectedErrorMessage } from '../../core/errors/unexpected-error-message';

/** Pausar/retomar e arquivar/reativar com feedback, compartilhados pela listagem e pelo detalhe. */
@Injectable({ providedIn: 'root' })
export class GoalActions {
  private readonly facade = inject(GoalsFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Retorna a meta atualizada, ou `null` se a operação falhar. */
  async togglePaused(goal: Goal): Promise<GoalWithProgress | null> {
    const pause = !goal.isPaused;
    try {
      const updated = await this.facade.setPaused(goal.id, pause);
      this.notify(pause ? 'Meta pausada.' : 'Meta retomada.');
      return updated;
    } catch (error) {
      this.notify(
        unexpectedErrorMessage('Não foi possível atualizar a meta. Tente novamente.', error),
      );
      return null;
    }
  }

  /** Retorna a meta atualizada, ou `null` se a pessoa cancelar ou a operação falhar. */
  async toggleArchived(goal: Goal): Promise<GoalWithProgress | null> {
    const archive = !goal.isArchived;
    const confirmed = await firstValueFrom(
      openConfirmDialog(
        this.dialog,
        archive
          ? {
              title: `Arquivar "${goal.name}"?`,
              message:
                'A meta deixa de aparecer entre as ativas e no Dashboard. O valor acumulado e o histórico são preservados.',
              confirmLabel: 'Arquivar',
            }
          : {
              title: `Reativar "${goal.name}"?`,
              message: 'A meta volta a aparecer entre as ativas.',
              confirmLabel: 'Reativar',
            },
      ),
    );
    if (!confirmed) {
      return null;
    }
    try {
      const updated = await this.facade.setArchived(goal.id, archive);
      this.notify(archive ? 'Meta arquivada.' : 'Meta reativada.');
      return updated;
    } catch (error) {
      this.notify(
        unexpectedErrorMessage('Não foi possível atualizar a meta. Tente novamente.', error),
      );
      return null;
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000 });
  }
}
