export interface NavigationItem {
  label: string;
  path: string;
  /** Nome do ícone no Material Symbols. */
  icon: string;
}

export interface NavigationGroup {
  label: string;
  items: readonly NavigationItem[];
}

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    label: 'Visão geral',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Movimentações',
    items: [
      { label: 'Contas', path: '/accounts', icon: 'account_balance_wallet' },
      { label: 'Transações', path: '/transactions', icon: 'swap_horiz' },
      { label: 'Categorias', path: '/categories', icon: 'sell' },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { label: 'Orçamentos', path: '/budgets', icon: 'pie_chart' },
      { label: 'Metas', path: '/goals', icon: 'savings' },
    ],
  },
  {
    label: 'Cartões',
    items: [
      { label: 'Cartões de crédito', path: '/credit-cards', icon: 'credit_card' },
      { label: 'Faturas', path: '/invoices', icon: 'receipt_long' },
    ],
  },
  {
    label: 'Conta',
    items: [
      { label: 'Configurações', path: '/settings', icon: 'settings' },
      { label: 'Segurança', path: '/security', icon: 'shield_lock' },
    ],
  },
];
