import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { CATEGORY_TYPES, Category, CategoryType } from '../../../shared/models/category';
import { CategoriesFacade } from '../categories.facade';
import { defaultCategoryQuery, queryCategories } from '../domain/category-rules';

@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatMenuModule,
    MatProgressBar,
    MatSlideToggle,
    IconAvatar,
  ],
  selector: 'app-category-list-page',
  templateUrl: './category-list-page.html',
  styleUrl: './category-list-page.scss',
})
export class CategoryListPage implements OnInit {
  private readonly facade = inject(CategoriesFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Query param `type`: aba aberta inicialmente (ao voltar do formulário, por exemplo). */
  readonly type = input<string>();

  protected readonly query = signal(defaultCategoryQuery());
  protected readonly filterForm = form(this.query);

  protected readonly status = this.facade.status;
  protected readonly visibleCategories = computed(() =>
    queryCategories(this.facade.categories(), this.query()),
  );
  protected readonly activeCount = computed(() => {
    const active = this.facade.categories().filter((category) => !category.isArchived);
    return {
      expense: active.filter((category) => category.type === 'expense').length,
      income: active.filter((category) => category.type === 'income').length,
    };
  });

  ngOnInit(): void {
    const type = this.type();
    if (isCategoryType(type)) {
      this.query.update((query) => ({ ...query, type }));
    }
    void this.facade.load();
  }

  protected reload(): void {
    void this.facade.load();
  }

  protected async toggleArchived(category: Category): Promise<void> {
    const archive = !category.isArchived;
    const confirmed = await firstValueFrom(
      openConfirmDialog(
        this.dialog,
        archive
          ? {
              title: `Arquivar "${category.name}"?`,
              message:
                'A categoria deixa de aparecer nas opções para novas transações. As transações já registradas continuam com ela, e você pode reativá-la quando quiser.',
              confirmLabel: 'Arquivar',
            }
          : {
              title: `Reativar "${category.name}"?`,
              message: 'A categoria volta a aparecer nas opções para novas transações.',
              confirmLabel: 'Reativar',
            },
      ),
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.facade.setArchived(category.id, archive);
      this.snackBar.open(archive ? 'Categoria arquivada.' : 'Categoria reativada.', 'Fechar', {
        duration: 4000,
      });
    } catch {
      this.snackBar.open('Não foi possível atualizar a categoria. Tente novamente.', 'Fechar', {
        duration: 5000,
      });
    }
  }
}

function isCategoryType(value: string | undefined): value is CategoryType {
  return CATEGORY_TYPES.includes(value as CategoryType);
}
