import { Account } from '../../shared/models/account';
import { Category } from '../../shared/models/category';
import { CreditCard } from '../../shared/models/credit-card';
import {
  Transaction,
  TransactionType,
  isCardPurchase,
  isInstallment,
  isInvoicePayment,
} from '../../shared/models/transaction';

/** Ícone de cada tipo, exibido junto ao texto (o tipo nunca é indicado só por cor). */
export const TRANSACTION_TYPE_ICONS: Readonly<Record<TransactionType, string>> = {
  expense: 'arrow_downward',
  income: 'arrow_upward',
  transfer: 'swap_horiz',
  'invoice-payment': 'credit_score',
};

/**
 * Sinal exibido antes do valor: despesas e pagamentos de fatura saem, receitas entram,
 * transferências só movem.
 */
export const TRANSACTION_SIGNS: Readonly<Record<TransactionType, string>> = {
  expense: '−',
  income: '+',
  transfer: '',
  'invoice-payment': '−',
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

/**
 * "Corrente"; em transferências, "Corrente → Poupança"; em compras, "Cartão Nubank"; em
 * pagamentos de fatura, "Corrente → Fatura Nubank".
 */
export function accountLabel(transaction: Transaction, lookups: TransactionLookups): string {
  const account = (id: string | null) => (id && lookups.accounts.get(id)?.name) || 'Conta removida';
  const card = (id: string | null) => (id && lookups.creditCards.get(id)?.name) || null;

  if (isCardPurchase(transaction)) {
    const name = card(transaction.creditCardId);
    return name ? `Cartão ${name}` : 'Cartão de crédito';
  }
  if (isInvoicePayment(transaction)) {
    const name = card(transaction.creditCardId);
    return `${account(transaction.accountId)} → ${name ? `Fatura ${name}` : 'Fatura do cartão'}`;
  }
  return transaction.type === 'transfer'
    ? `${account(transaction.accountId)} → ${account(transaction.destinationAccountId)}`
    : account(transaction.accountId);
}

/**
 * Pagamentos de fatura só são criados e desfeitos pela tela de Faturas; parcelas só mudam pela
 * compra parcelada (no detalhe da parcela).
 */
export function isEditable(transaction: Pick<Transaction, 'type' | 'installmentGroupId'>): boolean {
  return !isInvoicePayment(transaction) && !isInstallment(transaction);
}

/** Parcelas não são excluídas sozinhas: exclui-se a compra parcelada inteira. */
export function canDelete(transaction: Pick<Transaction, 'installmentGroupId'>): boolean {
  return !isInstallment(transaction);
}

/** "Parcela 3 de 10" numa parcela; `null` nas demais transações. */
export function installmentLabel(
  transaction: Pick<Transaction, 'installmentNumber' | 'installmentCount'>,
): string | null {
  return transaction.installmentNumber && transaction.installmentCount
    ? `Parcela ${transaction.installmentNumber} de ${transaction.installmentCount}`
    : null;
}

/** Compras no cartão e pagamentos de fatura são sempre realizados. */
export function canChangeStatus(transaction: Pick<Transaction, 'type' | 'creditCardId'>): boolean {
  return !isCardPurchase(transaction) && !isInvoicePayment(transaction);
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
