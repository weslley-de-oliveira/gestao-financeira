import { APPEARANCE_COLORS, isAppearanceOption } from '../../../shared/models/appearance';
import {
  CATEGORY_ICONS,
  CATEGORY_NAME_MAX_LENGTH,
  CATEGORY_TYPES,
  Category,
  CategoryType,
} from '../../../shared/models/category';
import { collapseWhitespace, normalizeForSearch } from '../../../shared/utils/text';

/** Dados editáveis de uma categoria. */
export type CategoryInput = Pick<Category, 'name' | 'type' | 'icon' | 'color' | 'isArchived'>;

/** Na edição o tipo não muda. */
export type CategoryUpdate = Omit<CategoryInput, 'type'>;

export class InvalidCategoryInputError extends Error {
  constructor(readonly field: keyof CategoryInput) {
    super(`Invalid category ${field}`);
    this.name = 'InvalidCategoryInputError';
  }
}

export class DuplicateCategoryNameError extends Error {
  constructor(readonly existing: Category) {
    super('Duplicate category name');
    this.name = 'DuplicateCategoryNameError';
  }
}

/** Valida e normaliza (espaços extras removidos) antes de persistir. */
export function normalizeCategoryInput<T extends CategoryUpdate & { type?: CategoryType }>(
  input: T,
): T {
  const name = collapseWhitespace(input.name);

  if (!name || name.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new InvalidCategoryInputError('name');
  }
  if (input.type !== undefined && !CATEGORY_TYPES.includes(input.type)) {
    throw new InvalidCategoryInputError('type');
  }
  if (!isAppearanceOption(APPEARANCE_COLORS, input.color)) {
    throw new InvalidCategoryInputError('color');
  }
  if (!isAppearanceOption(CATEGORY_ICONS, input.icon)) {
    throw new InvalidCategoryInputError('icon');
  }

  return { ...input, name };
}

/**
 * Procura outra categoria do mesmo tipo com o mesmo nome, sem diferenciar maiúsculas, acentos
 * e espaços extras. Arquivadas também contam, para não haver duas iguais ao reativar.
 */
export function findDuplicateCategory(
  categories: readonly Category[],
  candidate: { name: string; type: CategoryType },
  exceptId?: string,
): Category | null {
  const key = nameKey(candidate.name);
  return (
    categories.find(
      (category) =>
        category.id !== exceptId &&
        category.type === candidate.type &&
        nameKey(category.name) === key,
    ) ?? null
  );
}

export interface CategoryQuery {
  search: string;
  type: CategoryType;
  showArchived: boolean;
}

export const defaultCategoryQuery = (): CategoryQuery => ({
  search: '',
  type: 'expense',
  showArchived: false,
});

/** Filtra por tipo, status e nome (sem diferenciar maiúsculas e acentos) e ordena por nome. */
export function queryCategories(categories: readonly Category[], query: CategoryQuery): Category[] {
  const search = normalizeForSearch(query.search.trim());
  return categories
    .filter(
      (category) =>
        category.type === query.type &&
        (query.showArchived || !category.isArchived) &&
        (!search || normalizeForSearch(category.name).includes(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

function nameKey(name: string): string {
  return normalizeForSearch(collapseWhitespace(name));
}
