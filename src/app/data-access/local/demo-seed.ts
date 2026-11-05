import { AccountDto } from '../dto/account.dto';
import { BudgetDto } from '../dto/budget.dto';
import { CategoryDto } from '../dto/category.dto';
import { CreditCardDto } from '../dto/credit-card.dto';
import { GoalDto } from '../dto/goal.dto';
import { TransactionDto } from '../dto/transaction.dto';
import { UserDto } from '../dto/user.dto';
import { SeedMeta, monthsSinceAnchor, shiftSeedDates } from './seed-dates';

/** Coleções persistidas, no mesmo formato da API (DTOs). */
export interface LocalCollections {
  users: UserDto[];
  accounts: AccountDto[];
  transactions: TransactionDto[];
  categories: CategoryDto[];
  budgets: BudgetDto[];
  creditCards: CreditCardDto[];
  goals: GoalDto[];
}

/** Formato de `db/db.seed.json`. A coleção `invoices` não é usada: as faturas são calculadas. */
export interface DemoSeed extends LocalCollections {
  meta: SeedMeta;
}

/**
 * Seed da demonstração com as datas avançadas para o mês de `today`. O JSON fica num chunk
 * separado, baixado só na primeira visita (ou ao restaurar os dados).
 */
export async function loadDemoSeed(today: Date): Promise<LocalCollections> {
  const { default: seed } = await import('../../../../db/db.seed.json');
  return toLocalCollections(seed as unknown as DemoSeed, today);
}

/** Cópia das coleções do seed (o seed importado nunca é alterado), com as datas avançadas. */
export function toLocalCollections(seed: DemoSeed, today: Date): LocalCollections {
  const { users, accounts, transactions, categories, budgets, creditCards, goals } = seed;
  return shiftSeedDates(
    structuredClone({ users, accounts, transactions, categories, budgets, creditCards, goals }),
    monthsSinceAnchor(seed.meta.anchorDate, today),
  );
}
