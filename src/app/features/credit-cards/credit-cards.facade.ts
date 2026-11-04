import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionCleanup } from '../../core/auth/session-cleanup';
import { TODAY } from '../../core/services/period.service';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { TransactionRepository } from '../../data-access/repositories/transaction.repository';
import { CreditCard, CreditCardWithUsage } from '../../shared/models/credit-card';
import { Transaction } from '../../shared/models/transaction';
import { toIsoDate } from '../../shared/utils/date';
import { calculateCardUsage } from './domain/card-usage';
import {
  CreditCardInput,
  InvalidCreditCardInputError,
  normalizeCreditCardInput,
} from './domain/credit-card-input';

export type LoadStatus = 'loading' | 'ready' | 'error';

export class CreditCardNotFoundError extends Error {
  constructor() {
    super('Credit card not found');
    this.name = 'CreditCardNotFoundError';
  }
}

/**
 * Casos de uso dos cartões do usuário logado. Limite utilizado e próxima fatura são calculados a
 * partir das compras (transações com `creditCardId`), nunca persistidos.
 */
@Injectable({ providedIn: 'root' })
export class CreditCardsFacade {
  private readonly repository = inject(CreditCardRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly auth = inject(AuthService);
  private readonly today = inject(TODAY);
  private readonly _cards = signal<CreditCardWithUsage[]>([]);
  /** Transações do último carregamento, usadas para calcular o uso dos limites. */
  private purchases: readonly Transaction[] = [];
  private readonly _status = signal<LoadStatus>('loading');

  readonly cards = this._cards.asReadonly();
  readonly status = this._status.asReadonly();

  constructor() {
    // Ao encerrar a sessão, nada do usuário anterior fica em memória.
    inject(SessionCleanup).register(() => {
      this._cards.set([]);
      this.purchases = [];
      this._status.set('loading');
    });
  }

  async load(): Promise<void> {
    this._status.set('loading');
    try {
      const userId = this.userId();
      const [cards, transactions] = await Promise.all([
        firstValueFrom(this.repository.listByUser(userId)),
        firstValueFrom(this.transactions.listByUser(userId)),
      ]);
      this.purchases = transactions;
      this._cards.set(cards.map((card) => this.withUsage(card)));
      this._status.set('ready');
    } catch {
      this._status.set('error');
    }
  }

  /** Retorna `null` se o cartão não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<CreditCardWithUsage | null> {
    const userId = this.userId();
    const card = await firstValueFrom(this.repository.findById(id));
    if (!card || card.userId !== userId) {
      return null;
    }
    this.purchases = await firstValueFrom(this.transactions.listByUser(userId));
    return this.withUsage(card);
  }

  async create(input: CreditCardInput): Promise<CreditCardWithUsage> {
    const normalized = normalizeCreditCardInput(input);
    await this.assertPaymentAccount(normalized);
    const card: CreditCard = {
      ...normalized,
      id: crypto.randomUUID(),
      userId: this.userId(),
      createdAt: new Date().toISOString(),
    };
    return this.store(await firstValueFrom(this.repository.create(card)));
  }

  async update(id: string, input: CreditCardInput): Promise<CreditCardWithUsage> {
    const normalized = normalizeCreditCardInput(input);
    const previous = await this.getOwned(id);
    await this.assertPaymentAccount(normalized, previous);
    return this.store(await firstValueFrom(this.repository.update(id, normalized)));
  }

  /** Arquivar preserva o cartão e as compras; ele só deixa de aceitar novas compras. */
  async setArchived(id: string, isArchived: boolean): Promise<CreditCardWithUsage> {
    await this.getOwned(id);
    return this.store(await firstValueFrom(this.repository.update(id, { isArchived })));
  }

  /**
   * A conta de pagamento deve ser do usuário e estar ativa; na edição, a conta que o cartão já
   * usava continua válida mesmo se tiver sido arquivada.
   */
  private async assertPaymentAccount(input: CreditCardInput, previous?: CreditCard): Promise<void> {
    const accounts = await firstValueFrom(this.accounts.listByUser(this.userId()));
    const account = accounts.find((item) => item.id === input.paymentAccountId);
    if (!account || (account.isArchived && account.id !== previous?.paymentAccountId)) {
      throw new InvalidCreditCardInputError('paymentAccountId');
    }
  }

  private async getOwned(id: string): Promise<CreditCardWithUsage> {
    const card = await this.getById(id);
    if (!card) {
      throw new CreditCardNotFoundError();
    }
    return card;
  }

  private store(card: CreditCard): CreditCardWithUsage {
    const stored = this.withUsage(card);
    this._cards.update((cards) =>
      cards.some((item) => item.id === stored.id)
        ? cards.map((item) => (item.id === stored.id ? stored : item))
        : [...cards, stored],
    );
    return stored;
  }

  private withUsage(card: CreditCard): CreditCardWithUsage {
    return calculateCardUsage(card, this.purchases, toIsoDate(this.today()));
  }

  private userId(): string {
    const user = this.auth.currentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  }
}
