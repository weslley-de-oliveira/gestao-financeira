import { Transaction } from '../../../shared/models/transaction';
import { IsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from './installment-plan';

/** Compra parcelada no cartão: o resumo e as parcelas (compras comuns), da 1ª à última. */
export interface InstallmentPurchase {
  /** O `installmentGroupId` das parcelas. */
  id: string;
  userId: string;
  description: string;
  /** Soma das parcelas. */
  amount: Cents;
  installmentCount: number;
  creditCardId: string;
  categoryId: string;
  notes: string | null;
  installments: Transaction[];
}

/** Dados de uma compra parcelada nova: o total, a data da compra e o número de parcelas. */
export interface InstallmentPurchaseInput {
  description: string;
  amount: Cents;
  date: IsoDate;
  creditCardId: string;
  categoryId: string;
  installmentCount: number;
  notes: string | null;
}

/** O que muda na compra inteira; valores, datas e cartão não mudam (exclua e registre de novo). */
export type InstallmentPurchaseChanges = Partial<
  Pick<InstallmentPurchaseInput, 'description' | 'categoryId' | 'notes'>
>;

/** Uma parcela não muda sozinha: altere ou exclua a compra parcelada. */
export class InstallmentNotEditableError extends Error {
  constructor() {
    super('Installments change only through the installment purchase');
    this.name = 'InstallmentNotEditableError';
  }
}

export class InstallmentPurchaseNotFoundError extends Error {
  constructor() {
    super('Installment purchase not found');
    this.name = 'InstallmentPurchaseNotFoundError';
  }
}

/** Número de parcelas aceito (2 a 24) e ao menos 1 centavo por parcela. */
export function isValidInstallmentCount(count: number, amount: Cents): boolean {
  return (
    Number.isInteger(count) &&
    count >= MIN_INSTALLMENTS &&
    count <= MAX_INSTALLMENTS &&
    amount >= count
  );
}

/** A compra parcelada a partir das parcelas (todas do mesmo grupo). */
export function toInstallmentPurchase(installments: readonly Transaction[]): InstallmentPurchase {
  const sorted = [...installments].sort(
    (a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0),
  );
  const [first] = sorted;
  if (!first?.installmentGroupId || !first.creditCardId || !first.categoryId) {
    throw new InstallmentPurchaseNotFoundError();
  }
  return {
    id: first.installmentGroupId,
    userId: first.userId,
    description: first.description,
    amount: sorted.reduce((total, installment) => total + installment.amount, 0),
    installmentCount: first.installmentCount ?? sorted.length,
    creditCardId: first.creditCardId,
    categoryId: first.categoryId,
    notes: first.notes,
    installments: sorted,
  };
}
