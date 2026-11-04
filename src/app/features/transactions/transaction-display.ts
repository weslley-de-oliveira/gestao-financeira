import { Account } from '../../shared/models/account';
import { Category } from '../../shared/models/category';
import { CreditCard } from '../../shared/models/credit-card';
import { Transaction, TransactionType } from '../../shared/models/transaction';

/** Ícone de cada tipo, exibido junto ao texto (o tipo nunca é indicado só por cor). */
export const TRANSACTION_TYPE_ICONS: Readonly<Record<TransactionType, string>> = {
  expense: 'arrow_downward',
  income: 'arrow_upward',
  transfer: 'swap_horiz',
};

/** Sinal exibido antes do valor: despesas saem, receitas entram, transferências só movem. */
export const TRANSACTION_SIGNS: Readonly<Record<TransactionType, string>> = {
  expense: '−',
  income: '+',
  transfer: '',
};

/** Nomes de contas, categorias e cartões por id, para exibir as transações. */
export interface TransactionLookups {
  accounts: ReadonlyMap<string, Account>;
  categories: ReadonlyMap<string, Category>;
  creditCards: ReadonlyMap<string, CreditCard>;
}

export function byId<T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** "Corrente", em transferências "Corrente → Poupança" e, em compras, "Cartão Nubank". */
export function accountLabel(transaction: Transaction, lookups: TransactionLookups): string {
  if (transaction.creditCardId) {
    const card = lookups.creditCards.get(transaction.creditCardId);
    return card ? `Cartão ${card.name}` : 'Cartão de crédito';
  }
  const name = (id: string | null) => (id && lookups.accounts.get(id)?.name) || 'Conta removida';
  return transaction.type === 'transfer'
    ? `${name(transaction.accountId)} → ${name(transaction.destinationAccountId)}`
    : name(transaction.accountId);
}

/**
 * Valor com sinal do ponto de vista de uma conta: transferências saem da origem (−) e entram
 * no destino (+). Usado no detalhe da conta.
 */
export function signForAccount(transaction: Transaction, accountId: string): string {
  if (transaction.type === 'transfer') {
    return transaction.accountId === accountId ? '−' : '+';
  }
  return TRANSACTION_SIGNS[transaction.type];
}

export function categoryOf(
  transaction: Transaction,
  lookups: TransactionLookups,
): Category | undefined {
  return transaction.categoryId ? lookups.categories.get(transaction.categoryId) : undefined;
}
