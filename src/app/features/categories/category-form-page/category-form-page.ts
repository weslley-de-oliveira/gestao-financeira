import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import {
  STALE_RECORD_MESSAGE,
  StaleRecordError,
} from '../../../core/interceptors/stale-record-error';
import { ColorSelect } from '../../../shared/components/appearance-select/color-select';
import { IconSelect } from '../../../shared/components/appearance-select/icon-select';
import {
  CATEGORY_ICONS,
  CATEGORY_TYPE_LABELS,
  CategoryType,
} from '../../../shared/models/category';
import { CategoriesFacade } from '../categories.facade';
import { DuplicateCategoryNameError } from '../domain/category-rules';
import { categorySchema, emptyCategoryForm, toCategoryFormModel } from '../forms/category.schema';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Formulário de criação (`/categories/new?type=`) e edição (`/categories/:id/edit`). */
@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressBar,
    MatSlideToggle,
    ColorSelect,
    IconSelect,
  ],
  selector: 'app-category-form-page',
  templateUrl: './category-form-page.html',
  styleUrl: './category-form-page.scss',
})
export class CategoryFormPage implements OnInit {
  private readonly facade = inject(CategoriesFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();
  /** Query param `type`: tipo pré-selecionado na criação. */
  readonly type = input<string>();

  private readonly model = signal(emptyCategoryForm());
  protected readonly categoryForm = form(this.model, categorySchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly isDefault = signal(false);
  protected readonly loadState = signal<LoadState>('ready');
  protected readonly errorMessage = signal<string | null>(null);
  /** Versão do registro carregado (`updatedAt`), enviada no `If-Match` ao salvar. */
  private version: string | undefined;
  protected readonly typeLabel = computed(() => CATEGORY_TYPE_LABELS[this.model().type]);

  protected readonly iconOptions = CATEGORY_ICONS;

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      void this.loadCategory(id);
    } else if (this.type() === 'income') {
      this.model.set(emptyCategoryForm('income'));
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.categoryForm, async (field) => {
      const value = field().value();
      const id = this.id();
      try {
        const saved = id
          ? await this.facade.update(id, value, this.version)
          : await this.facade.create(value);
        this.snackBar.open(id ? 'Categoria atualizada.' : 'Categoria criada.', 'Fechar', {
          duration: 4000,
        });
        await this.router.navigate(['/categories'], { queryParams: { type: saved.type } });
      } catch (error) {
        if (error instanceof StaleRecordError) {
          this.errorMessage.set(STALE_RECORD_MESSAGE);
          return undefined;
        }
        if (error instanceof DuplicateCategoryNameError) {
          return {
            kind: 'duplicate',
            message: duplicateMessage(value.type, error.existing.isArchived),
            fieldTree: field.name,
          };
        }
        this.errorMessage.set('Não foi possível salvar a categoria. Tente novamente em instantes.');
      }
      return undefined;
    });
  }

  private async loadCategory(id: string): Promise<void> {
    this.loadState.set('loading');
    try {
      const category = await this.facade.getById(id);
      if (category) {
        this.model.set(toCategoryFormModel(category));
        this.isDefault.set(category.isDefault);
        this.version = category.updatedAt;
      }
      this.loadState.set(category ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }
}

function duplicateMessage(type: CategoryType, archived: boolean): string {
  const kind = type === 'income' ? 'receita' : 'despesa';
  return archived
    ? `Já existe uma categoria de ${kind} arquivada com este nome. Reative-a em vez de criar outra.`
    : `Já existe uma categoria de ${kind} com este nome.`;
}
