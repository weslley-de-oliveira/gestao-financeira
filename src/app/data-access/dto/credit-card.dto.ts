import { CardBrand, CreditCard } from '../../shared/models/credit-card';

/** Formato do recurso `creditCards` na API. Limite em centavos inteiros. */
export interface CreditCardDto {
  id: string;
  userId: string;
  name: string;
  brand: CardBrand;
  lastFourDigits: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
  color: string;
  isArchived: boolean;
  createdAt: string;
}

export function toCreditCard(dto: CreditCardDto): CreditCard {
  return {
    id: dto.id,
    userId: dto.userId,
    name: dto.name,
    brand: dto.brand,
    lastFourDigits: dto.lastFourDigits,
    creditLimit: dto.creditLimit,
    closingDay: dto.closingDay,
    dueDay: dto.dueDay,
    paymentAccountId: dto.paymentAccountId,
    color: dto.color,
    isArchived: dto.isArchived ?? false,
    createdAt: dto.createdAt,
  };
}

export function toCreditCardDto(card: CreditCard): CreditCardDto {
  return { ...card };
}
