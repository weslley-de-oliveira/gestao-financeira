import { Cents } from '../utils/money';

export const CARD_BRANDS = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other'] as const;

export type CardBrand = (typeof CARD_BRANDS)[number];

export const CARD_BRAND_LABELS: Readonly<Record<CardBrand, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
  other: 'Outra',
};

export const CREDIT_CARD_NAME_MAX_LENGTH = 40;

/** Dias de fechamento e vencimento; em meses mais curtos, o dia vira o último do mês. */
export const MIN_CARD_DAY = 1;
export const MAX_CARD_DAY = 31;

/**
 * Cartão de crédito fictício. Por segurança, guarda só os quatro últimos dígitos: nunca o número
 * completo (PAN), CVV, validade ou senha.
 */
export interface CreditCard {
  id: string;
  userId: string;
  /** Apelido do cartão. */
  name: string;
  brand: CardBrand;
  /** Exatamente quatro dígitos. */
  lastFourDigits: string;
  creditLimit: Cents;
  closingDay: number;
  dueDay: number;
  /** Conta usada para pagar as faturas. */
  paymentAccountId: string;
  /** Cor de identificação, uma das `APPEARANCE_COLORS`. */
  color: string;
  isArchived: boolean;
  createdAt: string;
}

/** Fatura de um cartão: compras de `start` a `end` (inclusive), fechada em `closingDate`. */
export interface InvoiceCycle {
  /** Mês do vencimento, `yyyy-MM`: a "fatura de dezembro" vence em dezembro. */
  referenceMonth: string;
  /** Primeiro dia de compras da fatura (o fechamento da anterior). */
  start: string;
  /** Último dia de compras da fatura (a véspera do fechamento). */
  end: string;
  closingDate: string;
  dueDate: string;
}

/** Cartão com o uso do limite e a próxima fatura, calculados (não persistidos). */
export interface CreditCardWithUsage extends CreditCard {
  /** Compras ainda não pagas. */
  usedLimit: Cents;
  /** Limite − utilizado; negativo quando o limite foi ultrapassado. */
  availableLimit: Cents;
  /** Fatura em aberto hoje e o total das compras já lançadas nela. */
  nextInvoice: InvoiceCycle & { amount: Cents };
}
