import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { TODAY } from '../../core/services/today';
import {
  NO_INSTALLMENT_ACTIONS,
  anticipatableInstallments,
  cancellationDescription,
  installmentStates,
  plannedCancellations,
  summarizeInstallmentActions,
} from '../../features/installments/domain/installment-actions';
import { planInstallments } from '../../features/installments/domain/installment-plan';
import {
  InstallmentPurchase,
  InstallmentPurchaseChanges,
  InstallmentPurchaseInput,
  InstallmentPurchaseNotFoundError,
  InvalidAnticipationCountError,
  NothingToAnticipateError,
  NothingToCancelError,
  toInstallmentPurchase,
} from '../../features/installments/domain/installment-rules';
import { Transaction } from '../../shared/models/transaction';
import { toIsoDate } from '../../shared/utils/date';
import { CreditCardRepository } from '../repositories/credit-card.repository';
import { InstallmentPurchaseRepository } from '../repositories/installment-purchase.repository';
import { TransactionSource } from '../repositories/transaction-source';
import { TransactionRepository } from '../repositories/transaction.repository';

/**
 * Compras parceladas no navegador (demo e testes): cada parcela é gravada como uma compra comum
 * no cartão, pelo repositório de transações, com as mesmas regras de divisão e datas da API.
 */
@Injectable()
export class LocalInstallmentPurchaseRepository extends InstallmentPurchaseRepository {
  private readonly transactions = inject(TransactionRepository);
  private readonly source = inject(TransactionSource);
  private readonly creditCards = inject(CreditCardRepository);
  private readonly today = inject(TODAY);

  create(userId: string, input: InstallmentPurchaseInput): Observable<InstallmentPurchase> {
    return defer(async () => {
      const card = await firstValueFrom(this.creditCards.findById(input.creditCardId));
      if (!card) {
        throw new InstallmentPurchaseNotFoundError();
      }
      const installmentGroupId = crypto.randomUUID();
      const plan = planInstallments(card, input, input.installmentCount);
      const installments: Transaction[] = [];
      for (const installment of plan) {
        installments.push(
          await firstValueFrom(
            this.transactions.create({
              userId,
              type: 'expense',
              description: input.description,
              amount: installment.amount,
              date: installment.date,
              accountId: null,
              creditCardId: input.creditCardId,
              invoiceMonth: null,
              destinationAccountId: null,
              categoryId: input.categoryId,
              status: 'completed',
              notes: input.notes,
              installmentGroupId,
              installmentNumber: installment.installmentNumber,
              installmentCount: input.installmentCount,
            }),
          ),
        );
      }
      return this.toPurchase(userId, installments);
    });
  }

  findById(userId: string, id: string): Observable<InstallmentPurchase | null> {
    return defer(async () => {
      const installments = await this.installments(userId, id);
      return installments.length > 0 ? this.toPurchase(userId, installments) : null;
    });
  }

  update(
    userId: string,
    id: string,
    changes: InstallmentPurchaseChanges,
  ): Observable<InstallmentPurchase> {
    return defer(async () => {
      const installments = await this.installments(userId, id);
      if (installments.length === 0) {
        throw new InstallmentPurchaseNotFoundError();
      }
      const updated = await Promise.all(
        installments.map((installment) =>
          firstValueFrom(this.transactions.update(installment.id, changes)),
        ),
      );
      return this.toPurchase(userId, updated);
    });
  }

  delete(userId: string, id: string): Observable<void> {
    return defer(async () => {
      const installments = await this.installments(userId, id);
      if (installments.length === 0) {
        throw new InstallmentPurchaseNotFoundError();
      }
      for (const installment of installments) {
        await firstValueFrom(this.transactions.delete(installment.id));
      }
    });
  }

  anticipate(userId: string, id: string, count: number): Observable<InstallmentPurchase> {
    return defer(async () => {
      const { installments, card, refunds, today } = await this.context(userId, id);
      const anticipatable = anticipatableInstallments(
        card,
        installmentStates(installments, refunds),
        today,
      );
      if (anticipatable.length === 0) {
        throw new NothingToAnticipateError();
      }
      if (count > anticipatable.length) {
        throw new InvalidAnticipationCountError();
      }
      for (const installment of anticipatable.slice(0, count)) {
        await firstValueFrom(this.transactions.update(installment.id, { date: today }));
      }
      return this.toPurchase(userId, await this.installments(userId, id));
    });
  }

  cancel(userId: string, id: string): Observable<Transaction[]> {
    return defer(async () => {
      const { installments, card, refunds, today } = await this.context(userId, id);
      const cancellations = plannedCancellations(
        card,
        installmentStates(installments, refunds),
        today,
      );
      if (cancellations.length === 0) {
        throw new NothingToCancelError();
      }
      const created: Transaction[] = [];
      for (const { installmentId, amount, date } of cancellations) {
        const installment = installments.find((item) => item.id === installmentId);
        created.push(
          await firstValueFrom(
            this.transactions.create({
              userId,
              type: 'refund',
              description: installment ? cancellationDescription(installment) : '',
              amount,
              date,
              accountId: null,
              creditCardId: card.id,
              invoiceMonth: null,
              destinationAccountId: null,
              categoryId: null,
              status: 'completed',
              notes: null,
              refundedTransactionId: installmentId,
            }),
          ),
        );
      }
      return created;
    });
  }

  /** As parcelas da compra, o cartão, os estornos do usuário e a data de hoje. */
  private async context(userId: string, id: string) {
    const installments = await this.installments(userId, id);
    const cardId = installments[0]?.creditCardId;
    const card = cardId ? await firstValueFrom(this.creditCards.findById(cardId)) : null;
    if (!card) {
      throw new InstallmentPurchaseNotFoundError();
    }
    const all = await firstValueFrom(this.source.listByUser(userId));
    return {
      installments,
      card,
      refunds: all.filter((transaction) => transaction.type === 'refund'),
      today: toIsoDate(this.today()),
    };
  }

  /** A compra com o resumo de antecipação e cancelamento de hoje, como a API calcula. */
  private async toPurchase(
    userId: string,
    installments: readonly Transaction[],
  ): Promise<InstallmentPurchase> {
    const cardId = installments[0]?.creditCardId;
    const [card, all] = await Promise.all([
      cardId ? firstValueFrom(this.creditCards.findById(cardId)) : Promise.resolve(null),
      firstValueFrom(this.source.listByUser(userId)),
    ]);
    const actions = card
      ? summarizeInstallmentActions(
          card,
          installments,
          all.filter((transaction) => transaction.type === 'refund'),
          toIsoDate(this.today()),
        )
      : NO_INSTALLMENT_ACTIONS;
    return toInstallmentPurchase(installments, actions);
  }

  private async installments(userId: string, id: string): Promise<Transaction[]> {
    const all = await firstValueFrom(this.source.listByUser(userId));
    return all.filter((transaction) => transaction.installmentGroupId === id);
  }
}
