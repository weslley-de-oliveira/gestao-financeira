import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
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
  private readonly transactions = inject(TransactionRepository);
  private readonly auth = inject(AuthService);
  private readonly _accounts = signal<AccountWithBalance[]>([]);
  /** Transações do último carregamento, usadas para calcular os saldos. */
  private movements: readonly BalanceMovement[] = [];
  private readonly _status = signal<LoadStatus>('loading');

  readonly accounts = this._accounts.asReadonly();
  readonly status = this._status.asReadonly();
  /** Patrimônio consolidado das contas ativas. */
  readonly totalActiveBalance = computed(() =>
    this._accounts()
      .filter((account) => !account.isArchived)
      .reduce((total, account) => total + account.currentBalance, 0),
  );

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this._accounts.set([]);
      this.movements = [];
      this._status.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      const userId = this.userId();
      const [accounts, movements] = await Promise.all([
        firstValueFrom(this.repository.listByUser(userId)),
        firstValueFrom(this.transactions.listByUser(userId)),
      ]);
      this.movements = movements;
      this._accounts.set(accounts.map((account) => this.withBalance(account)));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se a conta não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<AccountWithBalance | null> {
    const userId = this.userId();
    const account = await firstValueFrom(this.repository.findById(id));
    if (!account || account.userId !== userId) {
      return null;
    }
    this.movements = await firstValueFrom(this.transactions.listByUser(userId));
    return this.withBalance(account);
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
    const stored = this.withBalance(account);
    this._accounts.update((accounts) =>
      accounts.some((item) => item.id === stored.id)
        ? accounts.map((item) => (item.id === stored.id ? stored : item))
        : [...accounts, stored],
    );
    return stored;
  }

  /** Saldo atual pela regra única: saldo inicial + transações realizadas da conta. */
  private withBalance(account: Account): AccountWithBalance {
    return { ...account, currentBalance: calculateBalance(account, this.movements) };
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
