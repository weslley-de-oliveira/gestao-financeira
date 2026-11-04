import { Category } from '../../../shared/models/category';
import {
  InvalidCategoryInputError,
  defaultCategoryQuery,
  findDuplicateCategory,
  normalizeCategoryInput,
  queryCategories,
} from './category-rules';
import { DEFAULT_CATEGORIES } from './default-categories';

function category(overrides: Partial<Category>): Category {
  return {
    id: overrides.name ?? 'id',
    userId: 'user',
    name: 'Categoria',
    type: 'expense',
    icon: 'more_horiz',
    color: '#546e7a',
    isDefault: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('category rules', () => {
  const valid = {
    name: '  Casa   e  jardim ',
    type: 'expense' as const,
    icon: 'home',
    color: '#1565c0',
    isArchived: false,
  };

  it('normalizes the name, collapsing extra spaces', () => {
    expect(normalizeCategoryInput(valid).name).toBe('Casa e jardim');
  });

  it.each([
    ['name', { name: '   ' }],
    ['name', { name: 'x'.repeat(41) }],
    ['color', { color: 'red' }],
    ['icon', { icon: 'not-an-icon' }],
  ])('rejects an invalid %s', (field, overrides) => {
    let error: unknown;
    try {
      normalizeCategoryInput({ ...valid, ...overrides });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(InvalidCategoryInputError);
    expect((error as InvalidCategoryInputError).field).toBe(field);
  });

  describe('findDuplicateCategory', () => {
    const categories = [
      category({ id: '1', name: 'Saúde' }),
      category({ id: '2', name: 'Salário', type: 'income' }),
      category({ id: '3', name: 'Antiga', isArchived: true }),
    ];

    it('ignores case, accents and extra spaces within the same type', () => {
      expect(findDuplicateCategory(categories, { name: ' SAUDE ', type: 'expense' })?.id).toBe('1');
      expect(findDuplicateCategory(categories, { name: 'saúde', type: 'income' })).toBeNull();
    });

    it('considers archived categories', () => {
      expect(findDuplicateCategory(categories, { name: 'antiga', type: 'expense' })?.id).toBe('3');
    });

    it('ignores the category being edited', () => {
      expect(findDuplicateCategory(categories, { name: 'Saúde', type: 'expense' }, '1')).toBeNull();
    });
  });

  describe('queryCategories', () => {
    const categories = [
      category({ name: 'Transporte' }),
      category({ name: 'Alimentação' }),
      category({ name: 'Antiga', isArchived: true }),
      category({ name: 'Salário', type: 'income' }),
    ];

    function names(overrides: Partial<ReturnType<typeof defaultCategoryQuery>>): string[] {
      return queryCategories(categories, { ...defaultCategoryQuery(), ...overrides }).map(
        (c) => c.name,
      );
    }

    it('shows active expense categories sorted by name by default', () => {
      expect(names({})).toEqual(['Alimentação', 'Transporte']);
    });

    it('filters by type, archived status and name', () => {
      expect(names({ type: 'income' })).toEqual(['Salário']);
      expect(names({ showArchived: true })).toEqual(['Alimentação', 'Antiga', 'Transporte']);
      expect(names({ search: 'alimentacao' })).toEqual(['Alimentação']);
    });
  });

  it('has a valid default set without duplicates', () => {
    const accepted: Category[] = [];
    for (const [index, item] of DEFAULT_CATEGORIES.entries()) {
      expect(() => normalizeCategoryInput({ ...item, isArchived: false })).not.toThrow();
      expect(findDuplicateCategory(accepted, item)).toBeNull();
      accepted.push(category({ ...item, id: String(index) }));
    }
    expect(DEFAULT_CATEGORIES.some((item) => item.type === 'income')).toBe(true);
    expect(DEFAULT_CATEGORIES.some((item) => item.type === 'expense')).toBe(true);
  });
});
