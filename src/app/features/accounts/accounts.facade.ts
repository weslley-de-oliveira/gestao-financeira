import { NewRecord } from '../../data-access/repositories/new-record';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { GoalRepository } from '../../data-access/repositories/goal.repository';
import { TransactionSource } from '../../data-access/repositories/transaction-source';
import { Account, AccountWithBalance } from '../../shared/models/account';
import { GoalContribution } from '../../shared/models/goal';
import {
  BalanceMovement,
  calculateBalance,
  goalMovements,
  goalsTotal,
} from './domain/account-balance';
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
  /** Lista completa, só na demonstração e nos testes; a API já devolve os valores calculados. */
  private readonly transactions = inject(TransactionSource, { optional: true });
  private readonly goals = inject(GoalRepository);
  private readonly auth = inject(AuthService);
  private readonly _accounts = signal<AccountWithBalance[]>([]);
  /** Transações e movimentações de metas do último carregamento, usadas para calcular os saldos. */
  private movements: readonly BalanceMovement[] = [];
  /** Movimentações de metas do último carregamento, para o valor guardado em metas. */
  private contributions: readonly GoalContribution[] = [];
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
      this.contributions = [];
      this._status.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      const accounts = await firstValueFrom(this.repository.listByUser(this.userId()));
      await this.loadMovements(accounts);
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
    await this.loadMovements([account]);
    return this.withBalance(account);
  }

  async create(input: AccountInput): Promise<AccountWithBalance> {
    const account: NewRecord<Account> = { ...normalizeAccountInput(input), userId: this.userId() };
    return this.store(await firstValueFrom(this.repository.create(account)));
  }

  /** `version`: o `updatedAt` do registro quando o formulário o carregou. */
  async update(id: string, input: AccountInput, version?: string): Promise<AccountWithBalance> {
    const changes = normalizeAccountInput(input);
    await this.ensureOwnership(id);
    return this.store(await firstValueFrom(this.repository.update(id, changes, version)));
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

  /**
   * Transações e movimentações de metas para calcular os saldos que o repositório não trouxe
   * prontos (demo e testes). A API já devolve o saldo e o guardado em metas de cada conta, e as
   * listas completas nunca são carregadas.
   */
  private async loadMovements(accounts: readonly Account[]): Promise<void> {
    if (!this.transactions || accounts.every((account) => account.currentBalance !== undefined)) {
      this.movements = [];
      this.contributions = [];
      return;
    }
    const userId = this.userId();
    const [transactions, goals] = await Promise.all([
      firstValueFrom(this.transactions.listByUser(userId)),
      firstValueFrom(this.goals.listByUser(userId)),
    ]);
    this.contributions = goals.flatMap((goal) => goal.contributions);
    this.movements = [...transactions, ...goalMovements(this.contributions)];
  }

  /**
   * Saldo atual pela regra única: saldo inicial + transações realizadas e movimentações de metas
   * da conta (o aporte sai dela, a retirada volta).
   */
  private withBalance(account: Account): AccountWithBalance {
    return {
      ...account,
      currentBalance: account.currentBalance ?? calculateBalance(account, this.movements),
      goalsTotal: account.goalsTotal ?? goalsTotal(account.id, this.contributions),
    };
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
