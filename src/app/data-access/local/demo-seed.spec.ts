import { TestBed } from '@angular/core/testing';
import seedJson from '../../../../db/db.seed.json';
import { PasswordHasher } from '../../core/security/password-hasher';
import { calculateBalance } from '../../features/accounts/domain/account-balance';
import { DEFAULT_CATEGORIES } from '../../features/categories/domain/default-categories';
import { buildInvoice, listInvoices } from '../../features/invoices/domain/invoice-rules';
import { toTransaction } from './dto/transaction.dto';
import { DEMO_CREDENTIALS } from './demo-credentials';
import { DemoSeed, toLocalCollections } from './demo-seed';

/** O seed gerado por `npm run seed` respeita as regras de domínio do app. */
describe('db/db.seed.json', () => {
  const seed = seedJson as unknown as DemoSeed;
  const anchor = seed.meta.anchorDate;
  const transactions = seed.transactions.map(toTransaction);
  const ids = (records: { id: string }[]) => new Set(records.map((record) => record.id));
  const accountIds = ids(seed.accounts);
  const cardIds = ids(seed.creditCards);

  it('has the demo user, whose password hash matches the demo credentials', async () => {
    expect(seed.users).toHaveLength(1);
    const [user] = seed.users;
    expect(user.email).toBe(DEMO_CREDENTIALS.email);
    expect(JSON.stringify(seed)).not.toContain(DEMO_CREDENTIALS.password);

    const hasher = TestBed.inject(PasswordHasher);
    await expect(hasher.verify(DEMO_CREDENTIALS.password, user.passwordHash)).resolves.toBe(true);
  });

  it('belongs entirely to the demo user', () => {
    const { users, ...collections } = seed;
    const userId = users[0].id;
    for (const [name, records] of Object.entries(collections)) {
      if (Array.isArray(records)) {
        expect(
          records.every((record: { userId: string }) => record.userId === userId),
          name,
        ).toBe(true);
      }
    }
  });

  it('has the default category set', () => {
    expect(
      seed.categories.map(({ name, type, icon, color, isDefault }) => ({
        name,
        type,
        icon,
        color,
        isDefault,
      })),
    ).toEqual(DEFAULT_CATEGORIES.map((category) => ({ ...category, isDefault: true })));
  });

  it('only uses days 1 to 28, so shifting months never changes a day', () => {
    const dates = JSON.stringify(seed).match(/"(date|deadline|createdAt)":"\d{4}-\d{2}-\d{2}/g);
    expect(dates?.length).toBeGreaterThan(100);
    for (const date of dates ?? []) {
      expect(Number(date.slice(-2)), date).toBeLessThanOrEqual(28);
    }
  });

  it('has valid transactions for each type', () => {
    const categoryType = new Map(seed.categories.map((category) => [category.id, category.type]));
    for (const transaction of transactions) {
      const label = `${transaction.date} ${transaction.description}`;
      expect(Number.isInteger(transaction.amount) && transaction.amount > 0, label).toBe(true);
      switch (transaction.type) {
        case 'income':
        case 'expense':
          expect(categoryType.get(transaction.categoryId ?? ''), label).toBe(transaction.type);
          // Conta ou cartão, nunca os dois.
          expect(
            (transaction.accountId === null) !== (transaction.creditCardId === null),
            label,
          ).toBe(true);
          break;
        case 'transfer':
          expect(accountIds.has(transaction.accountId ?? ''), label).toBe(true);
          expect(accountIds.has(transaction.destinationAccountId ?? ''), label).toBe(true);
          expect(transaction.destinationAccountId, label).not.toBe(transaction.accountId);
          break;
        case 'invoice-payment':
          expect(accountIds.has(transaction.accountId ?? ''), label).toBe(true);
          expect(cardIds.has(transaction.creditCardId ?? ''), label).toBe(true);
          break;
      }
      if (transaction.creditCardId && transaction.type === 'expense') {
        expect(transaction.status, label).toBe('completed');
      }
      if (transaction.date > anchor) {
        expect(transaction.status, label).toBe('pending');
      }
    }
  });

  it('pays each past invoice with its exact total and leaves none overdue', () => {
    for (const card of seed.creditCards) {
      const invoices = listInvoices(card, transactions, anchor);
      for (const payment of transactions.filter(
        (transaction) =>
          transaction.type === 'invoice-payment' && transaction.creditCardId === card.id,
      )) {
        const invoice = buildInvoice(card, transactions, payment.invoiceMonth ?? '', anchor);
        expect(payment.amount, `${card.name} ${payment.invoiceMonth}`).toBe(invoice.total);
        expect(payment.accountId).toBe(card.paymentAccountId);
      }
      expect(invoices.some((invoice) => invoice.status === 'overdue')).toBe(false);
    }
  });

  it('keeps the invoices consistent after shifting the dates', () => {
    const shifted = toLocalCollections(seed, new Date(2027, 6, 20));
    const shiftedTransactions = shifted.transactions.map(toTransaction);
    for (const card of shifted.creditCards) {
      for (const payment of shiftedTransactions.filter(
        (transaction) =>
          transaction.type === 'invoice-payment' && transaction.creditCardId === card.id,
      )) {
        const invoice = buildInvoice(
          card,
          shiftedTransactions,
          payment.invoiceMonth ?? '',
          '2027-07-20',
        );
        expect(payment.amount).toBe(invoice.total);
      }
    }
  });

  it('never leaves an account with a negative balance', () => {
    for (const account of seed.accounts) {
      expect(calculateBalance(account, transactions), account.name).toBeGreaterThanOrEqual(0);
    }
  });

  it('has budgets only for expense categories, one per category', () => {
    const expenses = new Set(
      seed.categories.filter((category) => category.type === 'expense').map(({ id }) => id),
    );
    expect(seed.budgets.every((budget) => expenses.has(budget.categoryId))).toBe(true);
    expect(new Set(seed.budgets.map((budget) => budget.categoryId)).size).toBe(seed.budgets.length);
  });

  it('pays the cards from existing accounts', () => {
    expect(seed.creditCards.every((card) => accountIds.has(card.paymentAccountId))).toBe(true);
  });
});
