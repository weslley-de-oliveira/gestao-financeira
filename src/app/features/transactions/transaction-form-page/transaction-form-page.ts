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
import { TODAY } from '../../../core/services/period.service';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { TRANSACTION_TYPES, Transaction } from '../../../shared/models/transaction';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CategoriesFacade } from '../../categories/categories.facade';
import { InvalidTransactionInputError, TransactionInput } from '../domain/transaction-rules';
import {
  TransactionFormModel,
  emptyTransactionForm,
  toTransactionFormModel,
  toTransactionInput,
  transactionSchema,
} from '../forms/transaction.schema';
import { TransactionsFacade } from '../transactions.facade';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Mensagens para as referências recusadas pela facade (conta ou categoria indisponível). */
const REFERENCE_ERRORS: Partial<Record<keyof TransactionInput, string>> = {
  accountId: 'Selecione uma conta ativa.',
  destinationAccountId: 'Selecione uma conta de destino ativa e diferente da origem.',
  categoryId: 'Selecione uma categoria ativa do mesmo tipo da transação.',
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
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly today = inject(TODAY);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();
  /** Query params opcionais da criação: conta e tipo pré-selecionados. */
  readonly accountId = input<string>();
  readonly type = input<string>();

  private readonly model = signal(emptyTransactionForm(this.today()));
  /** Transação em edição: suas referências arquivadas continuam disponíveis nos selects. */
  private readonly original = signal<Transaction | null>(null);
  protected readonly transactionForm = form(this.model, transactionSchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly isTransfer = computed(() => this.model().type === 'transfer');
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal<string | null>(null);

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
      try {
        const saved = id ? await this.facade.update(id, input) : await this.facade.create(input);
        this.snackBar.open(id ? 'Transação atualizada.' : 'Transação registrada.', 'Fechar', {
          duration: 4000,
        });
        await this.router.navigate(id ? ['/transactions', saved.id] : ['/transactions']);
      } catch (error) {
        const message =
          error instanceof InvalidTransactionInputError ? REFERENCE_ERRORS[error.field] : undefined;
        if (error instanceof InvalidTransactionInputError && message) {
          return { kind: 'reference', message, fieldTree: field[error.field] };
        }
        this.errorMessage.set('Não foi possível salvar a transação. Tente novamente em instantes.');
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
      ]);
      if (this.accountsFacade.status() === 'error' || this.categoriesFacade.status() === 'error') {
        this.loadState.set('error');
        return;
      }
      if (id && !transaction) {
        this.loadState.set('not-found');
        return;
      }
      this.original.set(transaction);
      this.model.set(transaction ? toTransactionFormModel(transaction) : this.prefilledModel());
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  /** Conta e tipo vindos da URL (por exemplo, "Nova transação" no detalhe de uma conta). */
  private prefilledModel(): TransactionFormModel {
    const type = TRANSACTION_TYPES.find((value) => value === this.type()) ?? 'expense';
    const accounts = this.accountOptions();
    const accountId =
      accounts.find((account) => account.id === this.accountId())?.id ??
      (accounts.length === 1 ? accounts[0].id : '');
    return emptyTransactionForm(this.today(), { type, accountId });
  }
}
