import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { ACCOUNT_ICONS, ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../../shared/models/account';
import { ColorSelect } from '../../../shared/components/appearance-select/color-select';
import { IconSelect } from '../../../shared/components/appearance-select/icon-select';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { AccountsFacade } from '../accounts.facade';
import {
  accountSchema,
  emptyAccountForm,
  toAccountFormModel,
  toAccountInput,
} from '../forms/account.schema';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Formulário de criação (`/accounts/new`) e edição (`/accounts/:id/edit`). */
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
    MatSlideToggle,
    ColorSelect,
    IconSelect,
    MoneyMaskDirective,
  ],
  selector: 'app-account-form-page',
  templateUrl: './account-form-page.html',
  styleUrl: './account-form-page.scss',
})
export class AccountFormPage implements OnInit {
  private readonly facade = inject(AccountsFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();

  private readonly model = signal(emptyAccountForm());
  protected readonly accountForm = form(this.model, accountSchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loadState = signal<LoadState>('ready');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly cancelLink = computed(() => {
    const id = this.id();
    return id ? ['/accounts', id] : ['/accounts'];
  });

  protected readonly typeOptions = ACCOUNT_TYPES.map((value) => ({
    value,
    label: ACCOUNT_TYPE_LABELS[value],
  }));
  protected readonly iconOptions = ACCOUNT_ICONS;

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      void this.loadAccount(id);
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.accountForm, async (field) => {
      const input = toAccountInput(field().value());
      const id = this.id();
      try {
        const saved = id ? await this.facade.update(id, input) : await this.facade.create(input);
        this.snackBar.open(id ? 'Conta atualizada.' : 'Conta criada.', 'Fechar', {
          duration: 4000,
        });
        await this.router.navigate(['/accounts', saved.id]);
      } catch {
        this.errorMessage.set('Não foi possível salvar a conta. Tente novamente em instantes.');
      }
      return undefined;
    });
  }

  private async loadAccount(id: string): Promise<void> {
    this.loadState.set('loading');
    try {
      const account = await this.facade.getById(id);
      if (account) {
        this.model.set(toAccountFormModel(account));
      }
      this.loadState.set(account ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }
}
