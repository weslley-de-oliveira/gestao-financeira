import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
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
import { ALERT_THRESHOLD_OPTIONS, Budget } from '../../../shared/models/budget';
import { formatMonth, toIsoMonth } from '../../../shared/utils/month';
import { CategoriesFacade } from '../../categories/categories.facade';
import { BudgetsFacade, DuplicateBudgetError } from '../budgets.facade';
import { InvalidBudgetInputError } from '../domain/budget-rules';
import {
  budgetSchema,
  emptyBudgetForm,
  toBudgetFormModel,
  toBudgetInput,
} from '../forms/budget.schema';
import { unexpectedErrorMessage } from '../../../core/errors/unexpected-error-message';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Formulário de criação (`/budgets/new`) e edição (`/budgets/:id/edit`). */
@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressBar,
    MatSelectModule,
    MoneyMaskDirective,
  ],
  selector: 'app-budget-form-page',
  templateUrl: './budget-form-page.html',
  styleUrl: './budget-form-page.scss',
})
export class BudgetFormPage implements OnInit {
  private readonly facade = inject(BudgetsFacade);
  private readonly categoriesFacade = inject(CategoriesFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly today = inject(TODAY);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();
  /** Query param opcional da criação: categoria pré-selecionada. */
  readonly categoryId = input<string>();

  private readonly model = signal(emptyBudgetForm());
  private readonly original = signal<Budget | null>(null);
  protected readonly budgetForm = form(this.model, budgetSchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  /** Versão do registro carregado (`updatedAt`), enviada no `If-Match` ao salvar. */
  private version: string | undefined;
  protected readonly currentMonthLabel = formatMonth(toIsoMonth(this.today()));
  protected readonly thresholdOptions = ALERT_THRESHOLD_OPTIONS;

  /** Na criação: categorias de despesa ativas que ainda não têm orçamento. */
  protected readonly categoryOptions = computed(() => {
    const budgeted = new Set(this.facade.budgets().map((budget) => budget.categoryId));
    return this.categoriesFacade
      .categories()
      .filter(
        (category) =>
          category.type === 'expense' && !category.isArchived && !budgeted.has(category.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });
  /** Na edição a categoria não muda; só é exibida. */
  protected readonly categoryName = computed(() => {
    const id = this.original()?.categoryId;
    return this.categoriesFacade.categories().find((category) => category.id === id)?.name ?? '—';
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.budgetForm, async (field) => {
      const input = toBudgetInput(field().value());
      const id = this.id();
      try {
        await (id ? this.facade.update(id, input, this.version) : this.facade.create(input));
        this.snackBar.open(id ? 'Orçamento atualizado.' : 'Orçamento criado.', 'Fechar', {
          duration: 4000,
        });
        await this.router.navigate(['/budgets']);
      } catch (error) {
        if (error instanceof StaleRecordError) {
          this.errorMessage.set(STALE_RECORD_MESSAGE);
          return undefined;
        }
        if (error instanceof DuplicateBudgetError) {
          return {
            kind: 'duplicate',
            message: 'Esta categoria já tem um orçamento. Edite o existente.',
            fieldTree: field.categoryId,
          };
        }
        if (error instanceof InvalidBudgetInputError && error.field === 'categoryId') {
          return {
            kind: 'reference',
            message: 'Selecione uma categoria de despesa ativa.',
            fieldTree: field.categoryId,
          };
        }
        this.errorMessage.set(
          unexpectedErrorMessage(
            'Não foi possível salvar o orçamento. Tente novamente em instantes.',
            error,
          ),
        );
      }
      return undefined;
    });
  }

  private async load(): Promise<void> {
    const id = this.id();
    try {
      const [budget] = await Promise.all([
        id ? this.facade.getById(id) : Promise.resolve(null),
        this.facade.load(),
        this.categoriesFacade.load(),
      ]);
      if (this.facade.status() === 'error' || this.categoriesFacade.status() === 'error') {
        this.loadState.set('error');
        return;
      }
      if (id && !budget) {
        this.loadState.set('not-found');
        return;
      }
      this.original.set(budget);
      this.version = budget?.updatedAt;
      this.model.set(budget ? toBudgetFormModel(budget) : this.prefilledModel());
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  private prefilledModel() {
    const category = this.categoryOptions().find((item) => item.id === this.categoryId());
    return emptyBudgetForm({ categoryId: category?.id ?? '' });
  }
}
