import { maxLength, required, schema, validate } from '@angular/forms/signals';
import { APPEARANCE_COLORS } from '../../../shared/models/appearance';
import { CATEGORY_NAME_MAX_LENGTH, Category, CategoryType } from '../../../shared/models/category';
import { CategoryInput } from '../domain/category-rules';

export type CategoryFormModel = CategoryInput;

export const emptyCategoryForm = (type: CategoryType = 'expense'): CategoryFormModel => ({
  name: '',
  type,
  icon: 'more_horiz',
  color: APPEARANCE_COLORS[0].value,
  isArchived: false,
});

export function toCategoryFormModel(category: Category): CategoryFormModel {
  const { name, type, icon, color, isArchived } = category;
  return { name, type, icon, color, isArchived };
}

export const categorySchema = schema<CategoryFormModel>((p) => {
  required(p.name, { message: 'Informe o nome da categoria.' });
  validate(p.name, ({ value }) =>
    value() && !value().trim()
      ? { kind: 'blank', message: 'Informe o nome da categoria.' }
      : undefined,
  );
  maxLength(p.name, CATEGORY_NAME_MAX_LENGTH, {
    message: `O nome deve ter no máximo ${CATEGORY_NAME_MAX_LENGTH} caracteres.`,
  });
});
