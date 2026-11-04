import { Category, CategoryType } from '../../shared/models/category';

/** Formato do recurso `categories` na API. */
export interface CategoryDto {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
}

export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    userId: dto.userId,
    name: dto.name,
    type: dto.type,
    icon: dto.icon,
    color: dto.color,
    isDefault: dto.isDefault ?? false,
    isArchived: dto.isArchived ?? false,
    createdAt: dto.createdAt,
  };
}

export function toCategoryDto(category: Category): CategoryDto {
  return { ...category };
}
