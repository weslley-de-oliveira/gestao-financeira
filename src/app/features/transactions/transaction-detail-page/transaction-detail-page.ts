import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  Transaction,
} from '../../../shared/models/transaction';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CategoriesFacade } from '../../categories/categories.facade';
import { CreditCardsFacade } from '../../credit-cards/credit-cards.facade';
import { isCardPurchase, isInvoicePayment } from '../../../shared/models/transaction';
import { TransactionActions } from '../transaction-actions';
import {
  TRANSACTION_SIGNS,
  TRANSACTION_TYPE_ICONS,
  accountLabel,
  byId,
  canChangeStatus,
  categoryOf,
  installmentLabel,
  isEditable,
} from '../transaction-display';
import { PaidInvoiceError, TransactionsFacade } from '../transactions.facade';
import { InvalidTransactionInputError } from '../domain/transaction-rules';
import { InstallmentPurchase } from '../../installments/domain/installment-rules';
import { openInstallmentPurchaseDialog } from '../../installments/installment-purchase-dialog/installment-purchase-dialog';
import { InstallmentPurchasesFacade } from '../../installments/installment-purchases.facade';
import { openConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { firstValueFrom } from 'rxjs';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatProgressBar,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-transaction-detail-page',
  templateUrl: './transaction-detail-page.html',
  styleUrl: './transaction-detail-page.scss',
})
export class TransactionDetailPage implements OnInit {
  private readonly facade = inject(TransactionsFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly actions = inject(TransactionActions);
  private readonly router = inject(Router);
  private readonly installmentsFacade = inject(InstallmentPurchasesFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly transaction = signal<Transaction | null>(null);
  /** A compra parcelada, quando a transação é uma parcela. */
  protected readonly purchase = signal<InstallmentPurchase | null>(null);
  protected readonly busy = signal(false);
  protected readonly installmentLabel = installmentLabel;
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly lookups = computed(() => ({
    accounts: byId(this.accountsFacade.accounts()),
    categories: byId(this.categoriesFacade.categories()),
    creditCards: byId(this.creditCardsFacade.cards()),
  }));
  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly typeIcons = TRANSACTION_TYPE_ICONS;
  protected readonly statusLabels = TRANSACTION_STATUS_LABELS;
  protected readonly signs = TRANSACTION_SIGNS;
  protected readonly accountLabel = accountLabel;
  protected readonly categoryOf = categoryOf;
  protected readonly isCardPurchase = isCardPurchase;
  protected readonly isInvoicePayment = isInvoicePayment;
  protected readonly isEditable = isEditable;
  protected readonly canChangeStatus = canChangeStatus;

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const [transaction] = await Promise.all([
        this.facade.getById(this.id()),
        this.accountsFacade.load(),
        this.categoriesFacade.load(),
        this.creditCardsFacade.load(),
      ]);
      this.transaction.set(transaction);
      this.purchase.set(
        transaction?.installmentGroupId
          ? await this.installmentsFacade.getById(transaction.installmentGroupId)
          : null,
      );
      this.loadState.set(transaction ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }

  protected async toggleStatus(transaction: Transaction): Promise<void> {
    const updated = await this.actions.toggleStatus(transaction);
    if (updated) {
      this.transaction.set(updated);
    }
  }

  /** Descrição, categoria e observações da compra parcelada, em todas as parcelas. */
  protected async editPurchase(purchase: InstallmentPurchase): Promise<void> {
    const categories = this.categoriesFacade
      .categories()
      .filter(
        (category) =>
          category.type === 'expense' &&
          (!category.isArchived || category.id === purchase.categoryId),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const changes = await firstValueFrom(
      openInstallmentPurchaseDialog(this.dialog, { purchase, categories }),
    );
    if (!changes) {
      return;
    }
    await this.run(async () => {
      const updated = await this.installmentsFacade.update(purchase.id, changes);
      this.purchase.set(updated);
      this.transaction.set(
        updated.installments.find((item) => item.id === this.transaction()?.id) ?? null,
      );
      this.notify('Compra parcelada atualizada.');
    });
  }

  /** Exclui todas as parcelas, depois de confirmar. */
  protected async deletePurchase(purchase: InstallmentPurchase): Promise<void> {
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Excluir "${purchase.description}"?`,
        message: `As ${purchase.installmentCount} parcelas serão excluídas e o limite do cartão, liberado. Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir a compra',
      }),
    );
    if (!confirmed) {
      return;
    }
    await this.run(async () => {
      await this.installmentsFacade.delete(purchase.id);
      this.notify('Compra parcelada excluída.');
      await this.router.navigateByUrl('/transactions');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.notify(
        error instanceof PaidInvoiceError
          ? 'Uma das parcelas está numa fatura já paga. Desfaça o pagamento na tela de Faturas para excluir a compra.'
          : error instanceof InvalidTransactionInputError
            ? 'Escolha uma categoria de despesa ativa.'
            : 'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 5000 });
  }

  protected async delete(transaction: Transaction): Promise<void> {
    if (await this.actions.delete(transaction)) {
      await this.router.navigateByUrl('/transactions');
    }
  }
}
