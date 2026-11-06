import { Cents } from '../utils/money';
import { AppearanceOption } from './appearance';

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
  /** Cor de identificação, uma das `APPEARANCE_COLORS`. */
  color: string;
  /** Ícone do Material Symbols, um dos `ACCOUNT_ICONS`. */
  icon: string;
  isArchived: boolean;
  createdAt: string;
  /**
   * Saldo atual já calculado pelo servidor (API). Ausente nos repositórios locais: a facade
   * calcula pelas transações.
   */
  currentBalance?: Cents;
}

/** Conta com o saldo atual, calculado pela regra de domínio (não é persistido). */
export interface AccountWithBalance extends Account {
  currentBalance: Cents;
}

export const ACCOUNT_ICONS: readonly AppearanceOption[] = [
  { value: 'account_balance', label: 'Banco' },
  { value: 'account_balance_wallet', label: 'Carteira' },
  { value: 'savings', label: 'Cofrinho' },
  { value: 'payments', label: 'Dinheiro' },
  { value: 'trending_up', label: 'Investimento' },
  { value: 'credit_card', label: 'Cartão' },
  { value: 'store', label: 'Loja' },
  { value: 'home', label: 'Casa' },
];
