import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, ValidationError, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import {
  STALE_RECORD_MESSAGE,
  StaleRecordError,
} from '../../../core/interceptors/stale-record-error';
import { TODAY } from '../../../core/services/today';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import {
  EDITABLE_TRANSACTION_TYPES,
  Transaction,
  isInvoicePayment,
} from '../../../shared/models/transaction';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CategoriesFacade } from '../../categories/categories.facade';
import { CreditCardsFacade } from '../../credit-cards/credit-cards.facade';
import { MAX_INSTALLMENTS, planInstallments } from '../../installments/domain/installment-plan';
import {
  InstallmentPurchasesFacade,
  InvalidInstallmentCountError,
} from '../../installments/installment-purchases.facade';
import { toIsoDate } from '../../../shared/utils/date';
import { parseMoney } from '../../../shared/utils/money';
import { formatMonth } from '../../../shared/utils/month';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { InvalidTransactionInputError, TransactionInput } from '../domain/transaction-rules';
import {
  TransactionFormModel,
  emptyTransactionForm,
  isCardPurchaseModel,
  toTransactionFormModel,
  toTransactionInput,
  transactionSchema,
} from '../forms/transaction.schema';
import { PAID_INVOICE_MESSAGE } from '../transaction-actions';
import { PaidInvoiceError, TransactionsFacade } from '../transactions.facade';

/** `not-editable`: pagamentos de fatura só são criados e desfeitos pela tela de Faturas. */
type LoadState = 'loading' | 'ready' | 'not-found' | 'not-editable' | 'error';

/** Mensagens para as referências recusadas pela facade (conta ou categoria indisponível). */
const REFERENCE_ERRORS: Partial<Record<keyof TransactionInput, string>> = {
  accountId: 'Selecione uma conta ativa.',
  destinationAccountId: 'Selecione uma conta de destino ativa e diferente da origem.',
  categoryId: 'Selecione uma categoria ativa do mesmo tipo da transação.',
  creditCardId: 'Selecione um cartão ativo.',
};

/** Formulário de criação (`/transactions/new`) e edição (`/transactions/:id/edit`). */
@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressBar,
    MatSelectModule,
    MoneyMaskDirective,
  ],
  selector: 'app-transaction-form-page',
  templateUrl: './transaction-form-page.html',
  styleUrl: './transaction-form-page.scss',
})
export class TransactionFormPage implements OnInit {
  private readonly facade = inject(TransactionsFacade);
  private readonly installmentsFacade = inject(InstallmentPurchasesFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly creditCardsFacade = inject(CreditCardsFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly today = inject(TODAY);
  private readonly money = new MoneyPipe();

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();
  /** Query params opcionais da criação: conta (ou cartão) e tipo pré-selecionados. */
  readonly accountId = input<string>();
  readonly creditCardId = input<string>();
  readonly type = input<string>();

  private readonly model = signal(emptyTransactionForm(this.today()));
  /** Transação em edição: suas referências arquivadas continuam disponíveis nos selects. */
  private readonly original = signal<Transaction | null>(null);
  protected readonly transactionForm = form(this.model, transactionSchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly isTransfer = computed(() => this.model().type === 'transfer');
  protected readonly isCardPurchase = computed(() => isCardPurchaseModel(this.model()));
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  /** Versão do registro carregado (`updatedAt`), enviada no `If-Match` ao salvar. */
  private version: string | undefined;

  protected readonly accountOptions = computed(() => {
    const original = this.original();
    return this.accountsFacade
      .accounts()
      .filter(
        (account) =>
          !account.isArchived ||
          account.id === original?.accountId ||
          account.id === original?.destinationAccountId,
      );
  });
  protected readonly creditCardOptions = computed(() =>
    this.creditCardsFacade
      .cards()
      .filter((card) => !card.isArchived || card.id === this.original()?.creditCardId),
  );
  protected readonly installmentOptions = Array.from(
    { length: MAX_INSTALLMENTS },
    (_, index) => index + 1,
  );
  /** Prévia das parcelas: valor da 1ª, das demais e a fatura da última. */
  protected readonly installmentPreview = computed(() => {
    const model = this.model();
    const amount = parseMoney(model.amount);
    const card = this.creditCardsFacade.cards().find((item) => item.id === model.creditCardId);
    if (
      !isCardPurchaseModel(model) ||
      model.installments < 2 ||
      !card ||
      !model.date ||
      amount === null ||
      amount < model.installments
    ) {
      return null;
    }
    const plan = planInstallments(
      card,
      { amount, date: toIsoDate(model.date) },
      model.installments,
    );
    return {
      first: plan[0].amount,
      others: plan[plan.length - 1].amount,
      lastMonth: formatMonth(plan[plan.length - 1].referenceMonth),
    };
  });
  protected readonly installmentHint = computed(() => {
    const preview = this.installmentPreview();
    if (!preview) {
      return 'Cada parcela vai para a fatura de um mês.';
    }
    const values =
      preview.first === preview.others
        ? `Parcelas de ${this.money.transform(preview.others)}`
        : `1ª de ${this.money.transform(preview.first)} e as demais de ${this.money.transform(preview.others)}`;
    return `${values}; a última na fatura de ${preview.lastMonth}.`;
  });
  protected readonly categoryOptions = computed(() => {
    const { type } = this.model();
    const original = this.original();
    return this.categoriesFacade
      .categories()
      .filter(
        (category) =>
          category.type === type && (!category.isArchived || category.id === original?.categoryId),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  ngOnInit(): void {
    void this.load();
  }

  /** Ao trocar o tipo, descarta a categoria que deixou de ser compatível. */
  protected onTypeChange(): void {
    const { categoryId } = this.model();
    if (categoryId && !this.categoryOptions().some((category) => category.id === categoryId)) {
      this.transactionForm.categoryId().value.set('');
    }
  }

  protected errorText(errors: readonly ValidationError[], fallback: string): string | null {
    const [error] = errors;
    return error ? (error.message ?? fallback) : null;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.transactionForm, async (field) => {
      const input = toTransactionInput(field().value());
      const id = this.id();
      const installments = field().value().installments;
      try {
        if (!id && input.creditCardId && installments > 1) {
          await this.installmentsFacade.create({
            description: input.description,
            amount: input.amount,
            date: input.date,
            creditCardId: input.creditCardId,
            categoryId: input.categoryId ?? '',
            installmentCount: installments,
            notes: input.notes,
          });
          this.snackBar.open(`Compra registrada em ${installments} parcelas.`, 'Fechar', {
            duration: 4000,
          });
          await this.router.navigate(['/transactions']);
          return undefined;
        }
        const saved = id
          ? await this.facade.update(id, input, this.version)
          : await this.facade.create(input);
        this.snackBar.open(id ? 'Transação atualizada.' : 'Transação registrada.', 'Fechar', {
          duration: 4000,
        });
        await this.router.navigate(id ? ['/transactions', saved.id] : ['/transactions']);
      } catch (error) {
        if (error instanceof InvalidInstallmentCountError) {
          return {
            kind: 'installments',
            message: 'Parcele de 2 a 24 vezes, com pelo menos R$ 0,01 por parcela.',
            fieldTree: field.installments,
          };
        }
        if (error instanceof StaleRecordError) {
          this.errorMessage.set(STALE_RECORD_MESSAGE);
          return undefined;
        }
        const message =
          error instanceof InvalidTransactionInputError ? REFERENCE_ERRORS[error.field] : undefined;
        if (error instanceof InvalidTransactionInputError && message) {
          return { kind: 'reference', message, fieldTree: field[error.field] };
        }
        this.errorMessage.set(
          error instanceof PaidInvoiceError
            ? PAID_INVOICE_MESSAGE
            : 'Não foi possível salvar a transação. Tente novamente em instantes.',
        );
      }
      return undefined;
    });
  }

  private async load(): Promise<void> {
    const id = this.id();
    try {
      const [transaction] = await Promise.all([
        id ? this.facade.getById(id) : Promise.resolve(null),
        this.accountsFacade.load(),
        this.categoriesFacade.load(),
        this.creditCardsFacade.load(),
      ]);
      if (this.accountsFacade.status() === 'error' || this.categoriesFacade.status() === 'error') {
        this.loadState.set('error');
        return;
      }
      if (id && !transaction) {
        this.loadState.set('not-found');
        return;
      }
      if (transaction && isInvoicePayment(transaction)) {
        this.loadState.set('not-editable');
        return;
      }
      this.original.set(transaction);
      this.version = transaction?.updatedAt;
      this.model.set(transaction ? toTransactionFormModel(transaction) : this.prefilledModel());
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  /**
   * Conta, cartão e tipo vindos da URL (por exemplo, "Nova transação" no detalhe de uma conta ou
   * "Nova compra" no detalhe de um cartão).
   */
  private prefilledModel(): TransactionFormModel {
    const card = this.creditCardOptions().find((item) => item.id === this.creditCardId());
    if (card) {
      return emptyTransactionForm(this.today(), {
        paymentMethod: 'credit-card',
        creditCardId: card.id,
      });
    }
    const type = EDITABLE_TRANSACTION_TYPES.find((value) => value === this.type()) ?? 'expense';
    const accounts = this.accountOptions();
    const accountId =
      accounts.find((account) => account.id === this.accountId())?.id ??
      (accounts.length === 1 ? accounts[0].id : '');
    return emptyTransactionForm(this.today(), { type, accountId });
  }
}
