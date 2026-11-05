import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DemoData } from '../../data-access/repositories/demo-data';
import { openConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';

/** Confirma e restaura os dados iniciais da demo. Retorna `false` se a pessoa cancelar. */
export async function confirmRestoreDemoData(
  dialog: MatDialog,
  demoData: DemoData,
): Promise<boolean> {
  const confirmed = await firstValueFrom(
    openConfirmDialog(dialog, {
      title: 'Restaurar dados iniciais?',
      message:
        'Todos os dados salvos neste navegador serão apagados, inclusive contas de acesso criadas, e a demonstração voltará ao estado inicial. A sessão será encerrada.',
      confirmLabel: 'Restaurar',
    }),
  );
  if (confirmed) {
    await demoData.restoreInitialData();
  }
  return confirmed;
}
