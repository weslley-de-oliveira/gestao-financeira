import { AppearanceOption } from './appearance';

export const CATEGORY_TYPES = ['expense', 'income'] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const CATEGORY_TYPE_LABELS: Readonly<Record<CategoryType, string>> = {
  expense: 'Despesa',
  income: 'Receita',
};

export const CATEGORY_NAME_MAX_LENGTH = 40;

export interface Category {
  id: string;
  userId: string;
  name: string;
  /** Definido na criação e imutável, para manter as transações compatíveis. */
  type: CategoryType;
  /** Ícone do Material Symbols, um dos `CATEGORY_ICONS`. */
  icon: string;
  /** Cor de identificação, uma das `APPEARANCE_COLORS`. */
  color: string;
  /** Criada automaticamente com o conjunto inicial; `false` para as criadas pelo usuário. */
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  /** Versão do registro na API, enviada no `If-Match` das edições; ausente na demo. */
  updatedAt?: string;
  /** Transações que usam a categoria, em todos os períodos: calculado, nunca gravado. */
  transactionCount?: number;
}

export const CATEGORY_ICONS: readonly AppearanceOption[] = [
  { value: 'restaurant', label: 'Alimentação' },
  { value: 'shopping_cart', label: 'Mercado' },
  { value: 'home', label: 'Casa' },
  { value: 'directions_car', label: 'Carro' },
  { value: 'directions_bus', label: 'Transporte público' },
  { value: 'local_hospital', label: 'Saúde' },
  { value: 'school', label: 'Educação' },
  { value: 'sports_esports', label: 'Lazer' },
  { value: 'shopping_bag', label: 'Compras' },
  { value: 'receipt_long', label: 'Contas' },
  { value: 'bolt', label: 'Energia' },
  { value: 'wifi', label: 'Internet' },
  { value: 'pets', label: 'Pets' },
  { value: 'flight', label: 'Viagem' },
  { value: 'fitness_center', label: 'Academia' },
  { value: 'checkroom', label: 'Roupas' },
  { value: 'work', label: 'Trabalho' },
  { value: 'laptop', label: 'Freelance' },
  { value: 'trending_up', label: 'Investimentos' },
  { value: 'card_giftcard', label: 'Presente' },
  { value: 'payments', label: 'Dinheiro' },
  { value: 'more_horiz', label: 'Outros' },
];

/** Completa as categorias com a quantidade de transações de cada uma (demo e testes). */
export function withTransactionCounts(
  categories: readonly Category[],
  transactions: readonly { categoryId: string | null }[],
): Category[] {
  const counts = new Map<string, number>();
  for (const { categoryId } of transactions) {
    if (categoryId) {
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
  }
  return categories.map((category) => ({
    ...category,
    transactionCount: counts.get(category.id) ?? 0,
  }));
}
