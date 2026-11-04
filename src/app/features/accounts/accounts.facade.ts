import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { Account, AccountWithBalance } from '../../shared/models/account';
import { BalanceMovement, calculateBalance } from './domain/account-balance';
import { AccountInput, normalizeAccountInput } from './domain/account-input';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class AccountNotFoundError extends Error {
  constructor() {
    super('Account not found');
    this.name = 'AccountNotFoundError';
  }
}

/** Casos de uso das contas do usuário logado. As telas consomem esta facade, nunca o repositório. */
@Injectable({ providedIn: 'root' })
export class AccountsFacade {
  private readonly repository = inject(AccountRepository);
  private readonly auth = inject(AuthService);
  private readonly _accounts = signal<AccountWithBalance[]>([]);
  private readonly _status = signal<LoadStatus>('loading');

  readonly accounts = this._accounts.asReadonly();
  readonly status = this._status.asReadonly();
  /** Patrimônio consolidado das contas ativas. */
  readonly totalActiveBalance = computed(() =>
    this._accounts()
      .filter((account) => !account.isArchived)
      .reduce((total, account) => total + account.currentBalance, 0),
  );

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      const accounts = await firstValueFrom(this.repository.listByUser(this.userId()));
      this._accounts.set(accounts.map(withBalance));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se a conta não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<AccountWithBalance | null> {
    const account = await firstValueFrom(this.repository.findById(id));
    return account && account.userId === this.userId() ? withBalance(account) : null;
  }

  async create(input: AccountInput): Promise<AccountWithBalance> {
    const account: Account = {
      ...normalizeAccountInput(input),
      id: crypto.randomUUID(),
      userId: this.userId(),
      createdAt: new Date().toISOString(),
    };
    return this.store(await firstValueFrom(this.repository.create(account)));
  }

  async update(id: string, input: AccountInput): Promise<AccountWithBalance> {
    const changes = normalizeAccountInput(input);
    await this.ensureOwnership(id);
    return this.store(await firstValueFrom(this.repository.update(id, changes)));
  }

  /** Arquivar preserva a conta e o histórico; ela só deixa de aparecer entre as ativas. */
  async setArchived(id: string, isArchived: boolean): Promise<AccountWithBalance> {
    await this.ensureOwnership(id);
    return this.store(await firstValueFrom(this.repository.update(id, { isArchived })));
  }

  private async ensureOwnership(id: string): Promise<void> {
    if (!(await this.getById(id))) {
      throw new AccountNotFoundError();
    }
  }

  private store(account: Account): AccountWithBalance {
    const stored = withBalance(account);
    this._accounts.update((accounts) =>
      accounts.some((item) => item.id === stored.id)
        ? accounts.map((item) => (item.id === stored.id ? stored : item))
        : [...accounts, stored],
    );
    return stored;
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}

/** As transações ainda não existem: por enquanto o saldo atual parte apenas do saldo inicial. */
const NO_MOVEMENTS: readonly BalanceMovement[] = [];

function withBalance(account: Account): AccountWithBalance {
  return { ...account, currentBalance: calculateBalance(account, NO_MOVEMENTS) };
}
