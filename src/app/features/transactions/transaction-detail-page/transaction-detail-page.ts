import {
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TODAY } from '../../../core/services/today';
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
import { isCardPurchase, isCardRefund, isInvoicePayment } from '../../../shared/models/transaction';
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
import { HasRefundsError, PaidInvoiceError, TransactionsFacade } from '../transactions.facade';
import { InvalidTransactionInputError } from '../domain/transaction-rules';
import {
  InstallmentPurchase,
  InvalidAnticipationCountError,
  NothingToAnticipateError,
  NothingToCancelError,
} from '../../installments/domain/installment-rules';
import { openAnticipationDialog } from '../../installments/anticipation-dialog/anticipation-dialog';
import { invoiceCycleFor } from '../../credit-cards/domain/invoice-cycle';
import { toIsoDate } from '../../../shared/utils/date';
import { openInstallmentPurchaseDialog } from '../../installments/installment-purchase-dialog/installment-purchase-dialog';
import { InstallmentPurchasesFacade } from '../../installments/installment-purchases.facade';
import { openConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { firstValueFrom } from 'rxjs';
import { canRefund, refundedTotal, remainingToRefund } from '../../refunds/domain/refund-rules';
import { openRefundDialog } from '../../refunds/refund-dialog/refund-dialog';
import { RefundsFacade } from '../../refunds/refunds.facade';
import { unexpectedErrorMessage } from '../../../core/errors/unexpected-error-message';

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
export class TransactionDetailPage {
  private readonly facade = inject(TransactionsFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly actions = inject(TransactionActions);
  private readonly router = inject(Router);
  private readonly installmentsFacade = inject(InstallmentPurchasesFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly refundsFacade = inject(RefundsFacade);
  private readonly injector = inject(Injector);
  private readonly today = inject(TODAY);
  private readonly money = new MoneyPipe();

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly transaction = signal<Transaction | null>(null);
  /** A compra parcelada, quando a transação é uma parcela. */
  protected readonly purchase = signal<InstallmentPurchase | null>(null);
  /** Estornos da despesa, dos mais antigos aos mais recentes. */
  protected readonly refunds = signal<Transaction[]>([]);
  /** A despesa estornada, quando a transação é um estorno. */
  protected readonly refundedExpense = signal<Transaction | null>(null);
  protected readonly refundedTotal = computed(() => refundedTotal(this.refunds()));
  /** O que falta estornar da despesa. */
  protected readonly remaining = computed(() => {
    const transaction = this.transaction();
    return transaction ? remainingToRefund(transaction, this.refunds()) : 0;
  });
  protected readonly canRefund = canRefund;
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
  protected readonly isCardRefund = isCardRefund;
  protected readonly isInvoicePayment = isInvoicePayment;
  protected readonly isEditable = isEditable;
  protected readonly canChangeStatus = canChangeStatus;

  constructor() {
    // A despesa e os estornos dela abrem nesta mesma tela: carrega de novo a cada troca de id.
    effect(() => {
      this.id();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    const id = this.id();
    this.loadState.set('loading');
    try {
      const [transaction] = await Promise.all([
        this.facade.getById(id),
        this.accountsFacade.load(),
        this.categoriesFacade.load(),
        this.creditCardsFacade.load(),
      ]);
      const [purchase, refunds, refundedExpense] = await Promise.all([
        transaction?.installmentGroupId
          ? this.installmentsFacade.getById(transaction.installmentGroupId)
          : null,
        transaction?.type === 'expense' ? this.refundsFacade.listFor(transaction.id) : [],
        transaction?.refundedTransactionId
          ? this.facade.getById(transaction.refundedTransactionId)
          : null,
      ]);
      if (id !== this.id()) {
        return;
      }
      this.transaction.set(transaction);
      this.purchase.set(purchase);
      this.refunds.set(refunds);
      this.refundedExpense.set(refundedExpense);
      this.loadState.set(transaction ? 'ready' : 'not-found');
    } catch {
      if (id === this.id()) {
        this.loadState.set('error');
      }
    }
  }

  protected async toggleStatus(transaction: Transaction): Promise<void> {
    const updated = await this.actions.toggleStatus(transaction);
    if (updated) {
      this.transaction.set(updated);
    }
  }

  /** Estorna a despesa (padrão: o que falta estornar, com a data de hoje). */
  protected async registerRefund(expense: Transaction): Promise<void> {
    const saved = await firstValueFrom(
      openRefundDialog(this.dialog, this.injector, {
        expense,
        remaining: this.remaining(),
        today: this.today(),
      }),
    );
    if (saved) {
      this.refunds.update((refunds) => [...refunds, saved]);
      this.notify('Estorno registrado.');
    }
  }

  /** Descrição, valor, data e observações do estorno; o valor vai até o que falta estornar. */
  protected async editRefund(refund: Transaction, expense: Transaction): Promise<void> {
    let siblings: Transaction[];
    try {
      siblings = await this.refundsFacade.listFor(expense.id);
    } catch (error) {
      this.notify(
        unexpectedErrorMessage(
          'Não foi possível carregar os estornos da despesa. Tente novamente.',
          error,
        ),
      );
      return;
    }
    const saved = await firstValueFrom(
      openRefundDialog(this.dialog, this.injector, {
        expense,
        refund,
        remaining: remainingToRefund(expense, siblings, refund.id),
        today: this.today(),
      }),
    );
    if (saved) {
      this.transaction.set(saved);
      this.notify('Estorno atualizado.');
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

  /** Leva as últimas parcelas escolhidas para a fatura atual do cartão. */
  protected async anticipate(purchase: InstallmentPurchase): Promise<void> {
    const card = this.lookups().creditCards.get(purchase.creditCardId);
    if (!card) {
      return;
    }
    const count = await firstValueFrom(
      openAnticipationDialog(this.dialog, {
        purchase,
        invoiceMonth: invoiceCycleFor(card, toIsoDate(this.today())).referenceMonth,
      }),
    );
    if (!count) {
      return;
    }
    await this.run(async () => {
      await this.installmentsFacade.anticipate(purchase.id, count);
      this.notify(count === 1 ? 'Parcela antecipada.' : `${count} parcelas antecipadas.`);
      await this.load();
    });
  }

  /** Estorna o que falta das parcelas ainda não cobradas, depois de confirmar. */
  protected async cancelInstallments(purchase: InstallmentPurchase): Promise<void> {
    const { count, amount } = purchase.cancellable;
    const which =
      count === 1
        ? 'A parcela que ainda não foi cobrada será estornada'
        : `As ${count} parcelas que ainda não foram cobradas serão estornadas`;
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Cancelar as parcelas de "${purchase.description}"?`,
        message: `${which} (${this.money.transform(amount)}), cada uma na sua fatura. As parcelas de faturas fechadas não mudam. Para desfazer, exclua os estornos.`,
        confirmLabel: 'Cancelar as parcelas',
      }),
    );
    if (!confirmed) {
      return;
    }
    await this.run(async () => {
      await this.installmentsFacade.cancel(purchase.id);
      this.notify(count === 1 ? 'Parcela cancelada.' : 'Parcelas canceladas.');
      await this.load();
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
          : error instanceof HasRefundsError
            ? 'Uma das parcelas tem estornos. Exclua os estornos, no detalhe da parcela, antes de excluir a compra.'
            : error instanceof InvalidTransactionInputError
              ? 'Escolha uma categoria de despesa ativa.'
              : error instanceof NothingToAnticipateError ||
                  error instanceof InvalidAnticipationCountError
                ? 'As parcelas que podem ser antecipadas mudaram. Confira a compra e tente de novo.'
                : error instanceof NothingToCancelError
                  ? 'Não há mais parcelas a cancelar: as restantes já estão em faturas fechadas ou foram estornadas.'
                  : unexpectedErrorMessage(
                      'Não foi possível concluir a operação. Tente novamente.',
                      error,
                    ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 5000 });
  }

  /** Depois de excluir um estorno, volta para a despesa estornada. */
  protected async delete(transaction: Transaction): Promise<void> {
    if (await this.actions.delete(transaction)) {
      await this.router.navigateByUrl(
        transaction.refundedTransactionId
          ? `/transactions/${transaction.refundedTransactionId}`
          : '/transactions',
      );
    }
  }
}
