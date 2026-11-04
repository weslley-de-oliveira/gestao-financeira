import { Account, AccountType } from '../../shared/models/account';

/** Formato do recurso `accounts` na API. Valores monetários em centavos inteiros. */
export interface AccountDto {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institution: string | null;
  initialBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
  createdAt: string;
}

export function toAccount(dto: AccountDto): Account {
  return {
    id: dto.id,
    userId: dto.userId,
    name: dto.name,
    type: dto.type,
    institution: dto.institution ?? null,
    initialBalance: dto.initialBalance,
    color: dto.color,
    icon: dto.icon,
    isArchived: dto.isArchived ?? false,
    createdAt: dto.createdAt,
  };
}

export function toAccountDto(account: Account): AccountDto {
  return { ...account };
}
