import { Routes } from '@angular/router';

// Página provisória: cada rota passa a carregar a tela real da sua feature quando ela for implementada.
const loadPlaceholder = () =>
  import('./core/layout/page-placeholder/page-placeholder').then((m) => m.PagePlaceholder);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/public-layout/public-layout').then((m) => m.PublicLayout),
    children: [
      { path: 'login', title: 'Entrar', loadComponent: loadPlaceholder },
      { path: 'register', title: 'Criar conta', loadComponent: loadPlaceholder },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: 'dashboard', title: 'Dashboard', loadComponent: loadPlaceholder },
      { path: 'accounts', title: 'Contas', loadComponent: loadPlaceholder },
      { path: 'transactions', title: 'Transações', loadComponent: loadPlaceholder },
      { path: 'categories', title: 'Categorias', loadComponent: loadPlaceholder },
      { path: 'budgets', title: 'Orçamentos', loadComponent: loadPlaceholder },
      { path: 'credit-cards', title: 'Cartões de crédito', loadComponent: loadPlaceholder },
      { path: 'invoices', title: 'Faturas', loadComponent: loadPlaceholder },
      { path: 'goals', title: 'Metas', loadComponent: loadPlaceholder },
      { path: 'settings', title: 'Configurações', loadComponent: loadPlaceholder },
      { path: 'security', title: 'Segurança', loadComponent: loadPlaceholder },
    ],
  },
  {
    path: '**',
    title: 'Página não encontrada',
    loadComponent: () =>
      import('./core/layout/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
