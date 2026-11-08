import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormField, ValidationError, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TODAY } from '../../../core/services/today';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { openConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { MoneyMaskDirective } from '../../../shared/directives/money-mask.directive';
import {
  CONTRIBUTION_TYPE_LABELS,
  GOAL_STATUS_ICONS,
  GOAL_STATUS_LABELS,
  GoalContribution,
  GoalWithProgress,
} from '../../../shared/models/goal';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import {
  InsufficientGoalBalanceError,
  InvalidGoalInputError,
  goalProgressBarValue,
} from '../domain/goal-rules';
import {
  contributionSchema,
  emptyContributionForm,
  toContributionInput,
} from '../forms/goal.schema';
import { GoalActions } from '../goal-actions';
import { GoalsFacade } from '../goals.facade';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressBar,
    MatSelectModule,
    IconAvatar,
    IsoDatePipe,
    MoneyMaskDirective,
    MoneyPipe,
  ],
  selector: 'app-goal-detail-page',
  templateUrl: './goal-detail-page.html',
  styleUrl: './goal-detail-page.scss',
})
export class GoalDetailPage implements OnInit {
  private readonly facade = inject(GoalsFacade);
  private readonly accounts = inject(AccountsFacade);
  private readonly actions = inject(GoalActions);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly today = inject(TODAY);

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly goal = signal<GoalWithProgress | null>(null);
  protected readonly loadState = signal<LoadState>('loading');
  /** Aportes e retiradas, dos mais recentes para os mais antigos. */
  protected readonly history = computed(() =>
    [...(this.goal()?.contributions ?? [])].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    ),
  );

  private readonly contributionModel = signal(emptyContributionForm(this.today()));
  protected readonly contributionForm = form(this.contributionModel, contributionSchema);
  /** Contas que podem receber ou ceder o valor de uma movimentação nova. */
  protected readonly activeAccounts = computed(() =>
    this.accounts.accounts().filter((account) => !account.isArchived),
  );
  /** Nome de cada conta (inclusive arquivadas), para o histórico. */
  private readonly accountNames = computed(
    () => new Map(this.accounts.accounts().map((account) => [account.id, account.name])),
  );
  /** Explica o efeito da movimentação no saldo, conforme o tipo e a conta escolhidos. */
  protected readonly contributionHint = computed(() => {
    const { type, accountId } = this.contributionModel();
    if (accountId === null) {
      return 'Sem conta: só registra na meta, sem alterar saldos.';
    }
    return type === 'deposit'
      ? 'O valor sai da conta escolhida, sem contar como despesa.'
      : 'O valor volta para a conta escolhida, sem contar como receita.';
  });

  protected readonly statusLabels = GOAL_STATUS_LABELS;
  protected readonly statusIcons = GOAL_STATUS_ICONS;
  protected readonly typeLabels = CONTRIBUTION_TYPE_LABELS;
  protected readonly progressBarValue = goalProgressBarValue;

  ngOnInit(): void {
    void this.load();
    // Sem as contas, a meta ainda funciona: as movimentações só não podem escolher uma conta.
    void this.accounts.load();
  }

  /** Nome da conta da movimentação, ou `null` se não tiver conta (ou ela não carregou). */
  protected accountName(accountId: string | null): string | null {
    return accountId === null ? null : (this.accountNames().get(accountId) ?? null);
  }

  protected async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const goal = await this.facade.getById(this.id());
      this.goal.set(goal);
      this.loadState.set(goal ? 'ready' : 'not-found');
    } catch {
      this.loadState.set('error');
    }
  }

  protected errorText(errors: readonly ValidationError[], fallback: string): string | null {
    const [error] = errors;
    return error ? (error.message ?? fallback) : null;
  }

  protected async togglePaused(goal: GoalWithProgress): Promise<void> {
    this.update(await this.actions.togglePaused(goal));
  }

  protected async toggleArchived(goal: GoalWithProgress): Promise<void> {
    this.update(await this.actions.toggleArchived(goal));
  }

  protected async addContribution(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.contributionForm, async (field) => {
      const input = toContributionInput(field().value());
      try {
        this.goal.set(await this.facade.addContribution(this.id(), input));
        this.contributionForm().reset(emptyContributionForm(this.today()));
        this.notify(input.type === 'deposit' ? 'Aporte registrado.' : 'Retirada registrada.');
      } catch (error) {
        if (error instanceof InsufficientGoalBalanceError) {
          return {
            kind: 'insufficient',
            message: 'A retirada é maior que o valor acumulado.',
            fieldTree: field.amount,
          };
        }
        if (error instanceof InvalidGoalInputError && error.field === 'accountId') {
          return {
            kind: 'unavailableAccount',
            message: 'Selecione uma conta ativa.',
            fieldTree: field.accountId,
          };
        }
        if (error instanceof InvalidGoalInputError && error.field === 'date') {
          return {
            kind: 'futureDate',
            message: 'A data não pode ser futura.',
            fieldTree: field.date,
          };
        }
        this.notify('Não foi possível registrar a movimentação. Tente novamente.');
      }
      return undefined;
    });
  }

  protected async removeContribution(contribution: GoalContribution): Promise<void> {
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Excluir ${this.typeLabels[contribution.type].toLowerCase()}?`,
        message:
          contribution.accountId === null
            ? 'O valor acumulado da meta será recalculado.'
            : 'O valor acumulado da meta e o saldo da conta serão recalculados.',
        confirmLabel: 'Excluir',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      this.goal.set(await this.facade.removeContribution(this.id(), contribution.id));
      this.notify('Movimentação excluída.');
    } catch (error) {
      this.notify(
        error instanceof InsufficientGoalBalanceError
          ? 'Sem este aporte, as retiradas deixariam o acumulado negativo.'
          : 'Não foi possível excluir a movimentação. Tente novamente.',
      );
    }
  }

  private update(goal: GoalWithProgress | null): void {
    if (goal) {
      this.goal.set(goal);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000 });
  }
}
