import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { Transaction, TransactionStatus } from '../../shared/models/transaction';
import {
  InvalidTransactionInputError,
  TransactionInput,
  assertValidReferences,
  isCardPurchase,
  normalizeTransactionInput,
} from './domain/transaction-rules';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction not found');
    this.name = 'TransactionNotFoundError';
  }
}

/**
 * Casos de uso das transações do usuário logado. Carrega todas as transações do usuário;
 * período, filtros e paginação são aplicados na tela.
 */
@Injectable({ providedIn: 'root' })
export class TransactionsFacade {
  private readonly repository = inject(TransactionRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly categories = inject(CategoryRepository);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly auth = inject(AuthService);
  private readonly _transactions = signal<Transaction[]>([]);
  private readonly _status = signal<LoadStatus>('loading');

  readonly transactions = this._transactions.asReadonly();
  readonly status = this._status.asReadonly();

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      this._transactions.set(await firstValueFrom(this.repository.listByUser(this.userId())));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se a transação não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<Transaction | null> {
    const transaction = await firstValueFrom(this.repository.findById(id));
    return transaction && transaction.userId === this.userId() ? transaction : null;
  }

  async create(input: TransactionInput): Promise<Transaction> {
    const normalized = normalizeTransactionInput(input);
    await this.validateReferences(normalized);
    const transaction: Transaction = {
      ...normalized,
      id: crypto.randomUUID(),
      userId: this.userId(),
      createdAt: new Date().toISOString(),
    };
    return this.store(await firstValueFrom(this.repository.create(transaction)));
  }

  async update(id: string, input: TransactionInput): Promise<Transaction> {
    const normalized = normalizeTransactionInput(input);
    const previous = await this.getOwned(id);
    await this.validateReferences(normalized, previous);
    return this.store(await firstValueFrom(this.repository.update(id, normalized)));
  }

  /** Compras no cartão são sempre realizadas e não podem ficar pendentes. */
  async setStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const transaction = await this.getOwned(id);
    if (isCardPurchase(transaction) && status !== 'completed') {
      throw new InvalidTransactionInputError('status');
    }
    return this.store(await firstValueFrom(this.repository.update(id, { status })));
  }

  /** Exclusão física: o saldo das contas é recalculado a partir das transações restantes. */
  async delete(id: string): Promise<void> {
    await this.getOwned(id);
    await firstValueFrom(this.repository.delete(id));
    this._transactions.update((transactions) => transactions.filter((item) => item.id !== id));
  }

  private async validateReferences(input: TransactionInput, previous?: Transaction): Promise<void> {
    const userId = this.userId();
    const [accounts, categories, creditCards] = await Promise.all([
      firstValueFrom(this.accounts.listByUser(userId)),
      firstValueFrom(this.categories.listByUser(userId)),
      firstValueFrom(this.creditCards.listByUser(userId)),
    ]);
    assertValidReferences(input, { accounts, categories, creditCards }, previous);
  }

  private async getOwned(id: string): Promise<Transaction> {
    const transaction = await this.getById(id);
    if (!transaction) {
      throw new TransactionNotFoundError();
    }
    return transaction;
  }

  private store(transaction: Transaction): Transaction {
    this._transactions.update((transactions) =>
      transactions.some((item) => item.id === transaction.id)
        ? transactions.map((item) => (item.id === transaction.id ? transaction : item))
        : [...transactions, transaction],
    );
    return transaction;
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
