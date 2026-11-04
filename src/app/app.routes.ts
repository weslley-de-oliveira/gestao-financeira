import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guards';

// Página provisória: cada rota passa a carregar a tela real da sua feature quando ela for implementada.
const loadPlaceholder = () =>
  import('./core/layout/page-placeholder/page-placeholder').then((m) => m.PagePlaceholder);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./core/layout/public-layout/public-layout').then((m) => m.PublicLayout),
    children: [
      {
        path: 'login',
        title: 'Entrar',
        loadComponent: () => import('./core/auth/login-page/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Criar conta',
        loadComponent: () =>
          import('./core/auth/register-page/register-page').then((m) => m.RegisterPage),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'accounts',
        title: 'Contas',
        loadChildren: () =>
          import('./features/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES),
      },
      {
        path: 'transactions',
        title: 'Transações',
        loadChildren: () =>
          import('./features/transactions/transactions.routes').then((m) => m.TRANSACTIONS_ROUTES),
      },
      {
        path: 'categories',
        title: 'Categorias',
        loadChildren: () =>
          import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES),
      },
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
