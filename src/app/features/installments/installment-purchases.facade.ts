import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountRepository } from '../../data-access/repositories/account.repository';
import { CategoryRepository } from '../../data-access/repositories/category.repository';
import { CreditCardRepository } from '../../data-access/repositories/credit-card.repository';
import { InstallmentPurchaseRepository } from '../../data-access/repositories/installment-purchase.repository';
import { TransactionSource } from '../../data-access/repositories/transaction-source';
import { CreditCard } from '../../shared/models/credit-card';
import { isInvoicePaidFor, PaidInvoiceError } from '../invoices/domain/invoice-rules';
import {
  InvalidTransactionInputError,
  assertValidReferences,
  normalizeTransactionInput,
} from '../transactions/domain/transaction-rules';
import { planInstallments } from './domain/installment-plan';
import {
  InstallmentPurchase,
  InstallmentPurchaseChanges,
  InstallmentPurchaseInput,
  InstallmentPurchaseNotFoundError,
  isValidInstallmentCount,
} from './domain/installment-rules';

/** Número de parcelas fora de 2 a 24, ou menos de 1 centavo por parcela. */
export class InvalidInstallmentCountError extends Error {
  constructor() {
    super('Invalid installment count');
    this.name = 'InvalidInstallmentCountError';
  }
}

/**
 * Casos de uso das compras parceladas no cartão. A compra é validada como uma compra comum
 * (cartão e categoria de despesa ativos); cada parcela vai para a fatura do seu mês. Na API, o
 * servidor confere as faturas pagas (409 → `PaidInvoiceError`); na demo e nos testes, esta facade.
 */
@Injectable({ providedIn: 'root' })
export class InstallmentPurchasesFacade {
  private readonly repository = inject(InstallmentPurchaseRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly categories = inject(CategoryRepository);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly auth = inject(AuthService);
  /** Lista completa, só na demonstração e nos testes, para conferir as faturas pagas. */
  private readonly source = inject(TransactionSource, { optional: true });

  async create(input: InstallmentPurchaseInput): Promise<InstallmentPurchase> {
    const normalized = normalizeTransactionInput({
      type: 'expense',
      description: input.description,
      amount: input.amount,
      date: input.date,
      accountId: null,
      creditCardId: input.creditCardId,
      destinationAccountId: null,
      categoryId: input.categoryId,
      status: 'completed',
      notes: input.notes,
    });
    if (!isValidInstallmentCount(input.installmentCount, normalized.amount)) {
      throw new InvalidInstallmentCountError();
    }
    const userId = this.userId();
    const [accounts, categories, creditCards] = await Promise.all([
      firstValueFrom(this.accounts.listByUser(userId)),
      firstValueFrom(this.categories.listByUser(userId)),
      firstValueFrom(this.creditCards.listByUser(userId)),
    ]);
    assertValidReferences(normalized, { accounts, categories, creditCards });
    const card = creditCards.find((item) => item.id === input.creditCardId);
    if (card) {
      const dates = planInstallments(card, normalized, input.installmentCount).map(
        (installment) => installment.date,
      );
      await this.assertInvoicesOpen(card, dates);
    }
    return firstValueFrom(
      this.repository.create(userId, {
        ...input,
        description: normalized.description,
        notes: normalized.notes,
      }),
    );
  }

  /** Retorna `null` se a compra não existir ou pertencer a outro usuário. */
  async getById(id: string): Promise<InstallmentPurchase | null> {
    return firstValueFrom(this.repository.findById(this.userId(), id));
  }

  /** Descrição, categoria e observações de todas as parcelas, mesmo com faturas já pagas. */
  async update(id: string, changes: InstallmentPurchaseChanges): Promise<InstallmentPurchase> {
    const current = await this.getOwned(id);
    const description =
      changes.description === undefined
        ? undefined
        : normalizeTransactionInput({ ...this.asInput(current), description: changes.description })
            .description;
    if (changes.categoryId !== undefined && changes.categoryId !== current.categoryId) {
      const categories = await firstValueFrom(this.categories.listByUser(this.userId()));
      const category = categories.find((item) => item.id === changes.categoryId);
      if (!category || category.type !== 'expense' || category.isArchived) {
        throw new InvalidTransactionInputError('categoryId');
      }
    }
    return firstValueFrom(
      this.repository.update(this.userId(), id, {
        ...changes,
        ...(description !== undefined && { description }),
        ...(changes.notes !== undefined && { notes: changes.notes?.trim() || null }),
      }),
    );
  }

  /** Exclui todas as parcelas; recusado se alguma estiver numa fatura já paga. */
  async delete(id: string): Promise<void> {
    const current = await this.getOwned(id);
    const card = await firstValueFrom(this.creditCards.findById(current.creditCardId));
    if (card) {
      await this.assertInvoicesOpen(
        card,
        current.installments.map((installment) => installment.date),
      );
    }
    await firstValueFrom(this.repository.delete(this.userId(), id));
  }

  private async assertInvoicesOpen(card: CreditCard, dates: readonly string[]): Promise<void> {
    if (!this.source) {
      return;
    }
    const transactions = await firstValueFrom(this.source.listByUser(this.userId()));
    if (dates.some((date) => isInvoicePaidFor(card, transactions, date))) {
      throw new PaidInvoiceError();
    }
  }

  private async getOwned(id: string): Promise<InstallmentPurchase> {
    const purchase = await this.getById(id);
    if (!purchase) {
      throw new InstallmentPurchaseNotFoundError();
    }
    return purchase;
  }

  private asInput(purchase: InstallmentPurchase) {
    return {
      type: 'expense' as const,
      description: purchase.description,
      amount: purchase.amount,
      date: purchase.installments[0]?.date ?? '',
      accountId: null,
      creditCardId: purchase.creditCardId,
      destinationAccountId: null,
      categoryId: purchase.categoryId,
      status: 'completed' as const,
      notes: purchase.notes,
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
