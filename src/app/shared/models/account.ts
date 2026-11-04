import { Cents } from '../utils/money';

export const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'investment', 'other'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Readonly<Record<AccountType, string>> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro',
  investment: 'Investimento',
  other: 'Outro',
};

export const ACCOUNT_NAME_MAX_LENGTH = 60;
export const ACCOUNT_INSTITUTION_MAX_LENGTH = 60;

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institution: string | null;
  initialBalance: Cents;
  /** Cor de identificação, uma das `ACCOUNT_COLORS`. */
  color: string;
  /** Ícone do Material Symbols, um dos `ACCOUNT_ICONS`. */
  icon: string;
  isArchived: boolean;
  createdAt: string;
}

/** Conta com o saldo atual, calculado pela regra de domínio (não é persistido). */
export interface AccountWithBalance extends Account {
  currentBalance: Cents;
}

export interface AccountOption {
  value: string;
  label: string;
}

/** Cores de identificação: dados escolhidos pelo usuário, não tokens do tema. */
export const ACCOUNT_COLORS: readonly AccountOption[] = [
  { value: '#1565c0', label: 'Azul' },
  { value: '#2e7d32', label: 'Verde' },
  { value: '#6a1b9a', label: 'Roxo' },
  { value: '#c62828', label: 'Vermelho' },
  { value: '#ef6c00', label: 'Laranja' },
  { value: '#00838f', label: 'Ciano' },
  { value: '#ad1457', label: 'Rosa' },
  { value: '#546e7a', label: 'Cinza' },
];

export const ACCOUNT_ICONS: readonly AccountOption[] = [
  { value: 'account_balance', label: 'Banco' },
  { value: 'account_balance_wallet', label: 'Carteira' },
  { value: 'savings', label: 'Cofrinho' },
  { value: 'payments', label: 'Dinheiro' },
  { value: 'trending_up', label: 'Investimento' },
  { value: 'credit_card', label: 'Cartão' },
  { value: 'store', label: 'Loja' },
  { value: 'home', label: 'Casa' },
];
