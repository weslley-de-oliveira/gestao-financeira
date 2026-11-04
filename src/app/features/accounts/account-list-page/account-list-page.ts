import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, Account } from '../../../shared/models/account';
import { IconAvatar } from '../../../shared/components/icon-avatar/icon-avatar';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountArchiveAction } from '../account-archive';
import { AccountsFacade } from '../accounts.facade';
import {
  ACCOUNT_SORT_OPTIONS,
  ACCOUNT_STATUS_OPTIONS,
  defaultAccountQuery,
  queryAccounts,
} from '../domain/account-query';

@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatMenuModule,
    MatProgressBar,
    MatSelectModule,
    IconAvatar,
    MoneyPipe,
  ],
  selector: 'app-account-list-page',
  templateUrl: './account-list-page.html',
  styleUrl: './account-list-page.scss',
})
export class AccountListPage implements OnInit {
  private readonly facade = inject(AccountsFacade);
  private readonly archiveAction = inject(AccountArchiveAction);

  private readonly query = signal(defaultAccountQuery());
  protected readonly filterForm = form(this.query);

  protected readonly status = this.facade.status;
  protected readonly totalActiveBalance = this.facade.totalActiveBalance;
  protected readonly hasAccounts = computed(() => this.facade.accounts().length > 0);
  protected readonly visibleAccounts = computed(() =>
    queryAccounts(this.facade.accounts(), this.query()),
  );
  protected readonly activeCount = computed(
    () => this.facade.accounts().filter((account) => !account.isArchived).length,
  );

  protected readonly typeOptions = ACCOUNT_TYPES.map((value) => ({
    value,
    label: ACCOUNT_TYPE_LABELS[value],
  }));
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly statusOptions = ACCOUNT_STATUS_OPTIONS;
  protected readonly sortOptions = ACCOUNT_SORT_OPTIONS;

  ngOnInit(): void {
    void this.facade.load();
  }

  protected reload(): void {
    void this.facade.load();
  }

  protected clearFilters(): void {
    this.query.set(defaultAccountQuery());
  }

  protected toggleArchived(account: Account): void {
    void this.archiveAction.toggle(account);
  }
}
