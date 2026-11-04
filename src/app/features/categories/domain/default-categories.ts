import { Category } from '../../../shared/models/category';

export type DefaultCategory = Pick<Category, 'name' | 'type' | 'icon' | 'color'>;

/** Conjunto inicial criado para cada usuário no primeiro acesso às categorias. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Alimentação', type: 'expense', icon: 'restaurant', color: '#ef6c00' },
  { name: 'Moradia', type: 'expense', icon: 'home', color: '#1565c0' },
  { name: 'Transporte', type: 'expense', icon: 'directions_car', color: '#00838f' },
  { name: 'Saúde', type: 'expense', icon: 'local_hospital', color: '#c62828' },
  { name: 'Educação', type: 'expense', icon: 'school', color: '#6a1b9a' },
  { name: 'Lazer', type: 'expense', icon: 'sports_esports', color: '#ad1457' },
  { name: 'Compras', type: 'expense', icon: 'shopping_bag', color: '#2e7d32' },
  { name: 'Contas e serviços', type: 'expense', icon: 'receipt_long', color: '#546e7a' },
  { name: 'Outras despesas', type: 'expense', icon: 'more_horiz', color: '#546e7a' },
  { name: 'Salário', type: 'income', icon: 'work', color: '#2e7d32' },
  { name: 'Freelance', type: 'income', icon: 'laptop', color: '#1565c0' },
  { name: 'Investimentos', type: 'income', icon: 'trending_up', color: '#00838f' },
  { name: 'Presentes', type: 'income', icon: 'card_giftcard', color: '#ad1457' },
  { name: 'Outras receitas', type: 'income', icon: 'more_horiz', color: '#546e7a' },
];
