import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { planInstallments } from '../../features/installments/domain/installment-plan';
import {
  InstallmentPurchase,
  InstallmentPurchaseChanges,
  InstallmentPurchaseInput,
  InstallmentPurchaseNotFoundError,
  toInstallmentPurchase,
} from '../../features/installments/domain/installment-rules';
import { Transaction } from '../../shared/models/transaction';
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
      return toInstallmentPurchase(installments);
    });
  }

  findById(userId: string, id: string): Observable<InstallmentPurchase | null> {
    return defer(async () => {
      const installments = await this.installments(userId, id);
      return installments.length > 0 ? toInstallmentPurchase(installments) : null;
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
      return toInstallmentPurchase(updated);
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

  private async installments(userId: string, id: string): Promise<Transaction[]> {
    const all = await firstValueFrom(this.source.listByUser(userId));
    return all.filter((transaction) => transaction.installmentGroupId === id);
  }
}
