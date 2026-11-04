import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guards';

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
      {
        path: 'credit-cards',
        title: 'Cartões de crédito',
        loadChildren: () =>
          import('./features/credit-cards/credit-cards.routes').then((m) => m.CREDIT_CARDS_ROUTES),
      },
      {
        path: 'budgets',
        title: 'Orçamentos',
        loadChildren: () =>
          import('./features/budgets/budgets.routes').then((m) => m.BUDGETS_ROUTES),
      },
      {
        path: 'invoices',
        title: 'Faturas',
        loadComponent: () =>
          import('./features/invoices/invoices-page/invoices-page').then((m) => m.InvoicesPage),
      },
      {
        path: 'goals',
        title: 'Metas',
        loadChildren: () => import('./features/goals/goals.routes').then((m) => m.GOALS_ROUTES),
      },
      {
        path: 'settings',
        title: 'Configurações',
        loadComponent: () =>
          import('./features/settings/settings-page/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'security',
        title: 'Segurança',
        loadComponent: () =>
          import('./features/security/security-page/security-page').then((m) => m.SecurityPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Página não encontrada',
    loadComponent: () =>
      import('./core/layout/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
