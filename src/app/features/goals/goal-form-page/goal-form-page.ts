import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, ValidationError, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { ColorSelect } from '../../../shared/components/appearance-select/color-select';
import { IconSelect } from '../../../shared/components/appearance-select/icon-select';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import { GOAL_ICONS } from '../../../shared/models/goal';
import { InsufficientGoalBalanceError, InvalidGoalInputError } from '../domain/goal-rules';
import { goalSchema, emptyGoalForm, toGoalFormModel, toGoalInput } from '../forms/goal.schema';
import { GoalsFacade } from '../goals.facade';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/** Formulário de criação (`/goals/new`) e edição (`/goals/:id/edit`). */
@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressBar,
    ColorSelect,
    IconSelect,
    MoneyMaskDirective,
  ],
  selector: 'app-goal-form-page',
  templateUrl: './goal-form-page.html',
  styleUrl: './goal-form-page.scss',
})
export class GoalFormPage implements OnInit {
  private readonly facade = inject(GoalsFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();

  private readonly model = signal(emptyGoalForm());
  protected readonly goalForm = form(this.model, goalSchema);
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly cancelLink = computed(() => {
    const id = this.id();
    return id ? ['/goals', id] : ['/goals'];
  });
  protected readonly iconOptions = GOAL_ICONS;

  ngOnInit(): void {
    void this.load();
  }

  protected errorText(errors: readonly ValidationError[], fallback: string): string | null {
    const [error] = errors;
    return error ? (error.message ?? fallback) : null;
  }

  protected clearDeadline(): void {
    this.goalForm.deadline().value.set(null);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.goalForm, async (field) => {
      const input = toGoalInput(field().value());
      const id = this.id();
      try {
        const saved = id ? await this.facade.update(id, input) : await this.facade.create(input);
        this.snackBar.open(id ? 'Meta atualizada.' : 'Meta criada.', 'Fechar', { duration: 4000 });
        await this.router.navigate(['/goals', saved.id]);
      } catch (error) {
        if (error instanceof InvalidGoalInputError && error.field === 'deadline') {
          return {
            kind: 'pastDeadline',
            message: 'A data-limite deve ser hoje ou uma data futura.',
            fieldTree: field.deadline,
          };
        }
        if (error instanceof InsufficientGoalBalanceError) {
          return {
            kind: 'negativeBalance',
            message: 'Com esse valor inicial, as retiradas deixariam o acumulado negativo.',
            fieldTree: field.initialAmount,
          };
        }
        this.errorMessage.set('Não foi possível salvar a meta. Tente novamente em instantes.');
      }
      return undefined;
    });
  }

  private async load(): Promise<void> {
    const id = this.id();
    if (!id) {
      this.loadState.set('ready');
      return;
    }
    try {
      const goal = await this.facade.getById(id);
      if (goal) {
        this.model.set(toGoalFormModel(goal));
      }
      this.loadState.set(goal ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }
}
