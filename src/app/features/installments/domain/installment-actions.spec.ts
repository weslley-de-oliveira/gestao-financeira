import { Transaction } from '../../../shared/models/transaction';
import {
  InstallmentState,
  anticipatableInstallments,
  plannedCancellations,
  summarizeInstallmentActions,
} from './installment-actions';

// Os mesmos casos de `installment-actions.test.ts` da API. O cartão fecha dia 5 e vence dia 12.
// Hoje é 15/11/2026: a fatura atual é a de 12/2026, com compras de 05/11 a 04/12.
const card = { closingDay: 5, dueDay: 12 };
const today = '2026-11-15';

/** Compra de R$ 500,00 em 5x a partir de 10/09: faturas de 10/2026 a 02/2027. */
function installments(refunded: Record<number, number> = {}): InstallmentState[] {
  return ['2026-09-10', '2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10'].map(
    (date, index) => ({
      id: `p${index + 1}`,
      installmentNumber: index + 1,
      amount: 10_000,
      date,
      refunded: refunded[index + 1] ?? 0,
    }),
  );
}

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe('installment actions', () => {
  describe('anticipatableInstallments', () => {
    it('are the installments of invoices after the current one, from the last', () => {
      expect(ids(anticipatableInstallments(card, installments(), today))).toEqual(['p5', 'p4']);
    });

    it('leaves out installments with refunds, even partial ones', () => {
      expect(ids(anticipatableInstallments(card, installments({ 5: 1 }), today))).toEqual(['p4']);
    });

    it('on the closing day, the current invoice is already the next one', () => {
      expect(ids(anticipatableInstallments(card, installments(), '2026-12-05'))).toEqual(['p5']);
    });

    it('the day before closing, the installment of 10/12 is still in a future invoice', () => {
      expect(ids(anticipatableInstallments(card, installments(), '2026-12-04'))).toEqual([
        'p5',
        'p4',
      ]);
    });

    it('has nothing to anticipate when the last installment is in the current invoice', () => {
      expect(anticipatableInstallments(card, installments(), '2027-01-10')).toEqual([]);
    });
  });

  describe('plannedCancellations', () => {
    it('refunds the current invoice installment (today) and the future ones (on their date)', () => {
      expect(plannedCancellations(card, installments(), today)).toEqual([
        { installmentId: 'p3', amount: 10_000, date: today },
        { installmentId: 'p4', amount: 10_000, date: '2026-12-10' },
        { installmentId: 'p5', amount: 10_000, date: '2027-01-10' },
      ]);
    });

    it('refunds only what is left and skips fully refunded installments', () => {
      expect(plannedCancellations(card, installments({ 3: 2_500, 4: 10_000 }), today)).toEqual([
        { installmentId: 'p3', amount: 7_500, date: today },
        { installmentId: 'p5', amount: 10_000, date: '2027-01-10' },
      ]);
    });

    it('includes an anticipated installment (dated today)', () => {
      const anticipated = installments().map((installment) =>
        installment.id === 'p5' ? { ...installment, date: today } : installment,
      );

      const planned = plannedCancellations(card, anticipated, today);

      expect(planned.map((item) => item.installmentId)).toEqual(['p3', 'p4', 'p5']);
      expect(planned[2]).toMatchObject({ amount: 10_000, date: today });
    });

    it('has nothing to cancel when every invoice of the purchase is closed', () => {
      expect(plannedCancellations(card, installments(), '2027-02-05')).toEqual([]);
    });
  });

  describe('summarizeInstallmentActions', () => {
    it('sums the refunds of each installment from the transaction list', () => {
      // As parcelas sem estornos: a soma sai da lista de estornos.
      const transactions = installments() as unknown as Transaction[];
      const refunds = [
        { refundedTransactionId: 'p5', amount: 1_000 },
        { refundedTransactionId: 'p3', amount: 500 },
        { refundedTransactionId: 'other', amount: 9_999 },
      ] as Transaction[];

      expect(summarizeInstallmentActions(card, transactions, refunds, today)).toEqual({
        anticipatableCount: 1,
        cancellable: { count: 3, amount: 28_500 },
      });
    });
  });
});
