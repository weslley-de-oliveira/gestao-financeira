import { CreditCard } from '../../../shared/models/credit-card';
import { Transaction } from '../../../shared/models/transaction';
import { IsoDate } from '../../../shared/utils/date';
import { Cents } from '../../../shared/utils/money';
import { invoiceCycleFor } from '../../credit-cards/domain/invoice-cycle';

type CardDays = Pick<CreditCard, 'closingDay' | 'dueDay'>;

/** Uma parcela com o que já foi estornado dela. */
export interface InstallmentState {
  id: string;
  installmentNumber: number;
  amount: Cents;
  date: IsoDate;
  /** Soma dos estornos da parcela. */
  refunded: Cents;
}

/** O estorno que cancela o que falta de uma parcela. */
export interface PlannedCancellation {
  installmentId: string;
  amount: Cents;
  date: IsoDate;
}

/** O que dá para fazer hoje com a compra parcelada (o mesmo resumo da API). */
export interface InstallmentActionsSummary {
  /** Parcelas que podem ir para a fatura atual. */
  anticipatableCount: number;
  /** O que o cancelamento estornaria. */
  cancellable: { count: number; amount: Cents };
}

export const NO_INSTALLMENT_ACTIONS: InstallmentActionsSummary = {
  anticipatableCount: 0,
  cancellable: { count: 0, amount: 0 },
};

/**
 * Parcelas que podem ir para a fatura atual (a que contém `today`): as de faturas seguintes e sem
 * estornos, da última para a primeira, porque os bancos antecipam a partir do fim. Porte de
 * `installment-actions.ts` da API.
 */
export function anticipatableInstallments<T extends InstallmentState>(
  card: CardDays,
  installments: readonly T[],
  today: IsoDate,
): T[] {
  const current = invoiceCycleFor(card, today);
  return installments
    .filter((installment) => installment.date > current.end && installment.refunded === 0)
    .sort((a, b) => b.installmentNumber - a.installmentNumber);
}

/**
 * Estornos que cancelam o que ainda não foi cobrado: o que falta estornar de cada parcela da fatura
 * atual e das futuras, da primeira à última. Cada estorno fica na data da parcela, ou hoje se ela
 * já passou, para cair na mesma fatura dela. Parcelas de faturas fechadas já foram cobradas.
 */
export function plannedCancellations(
  card: CardDays,
  installments: readonly InstallmentState[],
  today: IsoDate,
): PlannedCancellation[] {
  const current = invoiceCycleFor(card, today);
  return installments
    .filter(
      (installment) =>
        installment.date >= current.start && installment.amount > installment.refunded,
    )
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
    .map((installment) => ({
      installmentId: installment.id,
      amount: installment.amount - installment.refunded,
      date: installment.date < today ? today : installment.date,
    }));
}

/** As parcelas com a soma dos estornos de cada uma, a partir de todos os estornos do usuário. */
export function installmentStates(
  installments: readonly Transaction[],
  refunds: readonly Transaction[],
): (Transaction & InstallmentState)[] {
  return installments.map((installment) => ({
    ...installment,
    installmentNumber: installment.installmentNumber ?? 0,
    refunded: refunds
      .filter((refund) => refund.refundedTransactionId === installment.id)
      .reduce((total, refund) => total + refund.amount, 0),
  }));
}

/** O resumo de antecipação e cancelamento da compra, como a API devolve. */
export function summarizeInstallmentActions(
  card: CardDays,
  installments: readonly Transaction[],
  refunds: readonly Transaction[],
  today: IsoDate,
): InstallmentActionsSummary {
  const states = installmentStates(installments, refunds);
  const cancellations = plannedCancellations(card, states, today);
  return {
    anticipatableCount: anticipatableInstallments(card, states, today).length,
    cancellable: {
      count: cancellations.length,
      amount: cancellations.reduce((total, cancellation) => total + cancellation.amount, 0),
    },
  };
}
