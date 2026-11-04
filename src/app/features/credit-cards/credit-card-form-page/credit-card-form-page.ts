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
import { ColorSelect } from '../../../shared/components/appearance-select/color-select';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { CARD_BRANDS, CARD_BRAND_LABELS, CreditCard } from '../../../shared/models/credit-card';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CreditCardsFacade } from '../credit-cards.facade';
import { InvalidCreditCardInputError } from '../domain/credit-card-input';
import {
  CARD_DAY_OPTIONS,
  CreditCardFormModel,
  creditCardSchema,
  emptyCreditCardForm,
  toCreditCardFormModel,
  toCreditCardInput,
} from '../forms/credit-card.schema';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Formulário de criação (`/credit-cards/new`) e edição (`/credit-cards/:id/edit`). */
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
    MoneyMaskDirective,
  ],
  selector: 'app-credit-card-form-page',
  templateUrl: './credit-card-form-page.html',
  styleUrl: './credit-card-form-page.scss',
})
export class CreditCardFormPage implements OnInit {
  private readonly facade = inject(CreditCardsFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();

  private readonly model = signal(emptyCreditCardForm());
  /** Cartão em edição: a conta de pagamento arquivada continua disponível no select. */
  private readonly original = signal<CreditCard | null>(null);
  protected readonly cardForm = form(this.model, creditCardSchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly cancelLink = computed(() => {
    const id = this.id();
    return id ? ['/credit-cards', id] : ['/credit-cards'];
  });

  protected readonly accountOptions = computed(() =>
    this.accountsFacade
      .accounts()
      .filter((account) => !account.isArchived || account.id === this.original()?.paymentAccountId),
  );
  protected readonly brandOptions = CARD_BRANDS.map((value) => ({
    value,
    label: CARD_BRAND_LABELS[value],
  }));
  protected readonly dayOptions = CARD_DAY_OPTIONS;

  ngOnInit(): void {
    void this.load();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.cardForm, async (field) => {
      const input = toCreditCardInput(field().value());
      const id = this.id();
      try {
        const saved = id ? await this.facade.update(id, input) : await this.facade.create(input);
        this.snackBar.open(id ? 'Cartão atualizado.' : 'Cartão cadastrado.', 'Fechar', {
          duration: 4000,
        });
        await this.router.navigate(['/credit-cards', saved.id]);
      } catch (error) {
        if (error instanceof InvalidCreditCardInputError && error.field === 'paymentAccountId') {
          return {
            kind: 'reference',
            message: 'Selecione uma conta ativa.',
            fieldTree: field.paymentAccountId,
          };
        }
        this.errorMessage.set('Não foi possível salvar o cartão. Tente novamente em instantes.');
      }
      return undefined;
    });
  }

  private async load(): Promise<void> {
    const id = this.id();
    try {
      const [card] = await Promise.all([
        id ? this.facade.getById(id) : Promise.resolve(null),
        this.accountsFacade.load(),
      ]);
      if (this.accountsFacade.status() === 'error') {
        this.loadState.set('error');
        return;
      }
      if (id && !card) {
        this.loadState.set('not-found');
        return;
      }
      this.original.set(card);
      this.model.set(card ? toCreditCardFormModel(card) : this.prefilledModel());
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  /** Com uma única conta ativa, ela já vem selecionada como conta de pagamento. */
  private prefilledModel(): CreditCardFormModel {
    const accounts = this.accountOptions();
    return emptyCreditCardForm({ paymentAccountId: accounts.length === 1 ? accounts[0].id : '' });
  }
}
