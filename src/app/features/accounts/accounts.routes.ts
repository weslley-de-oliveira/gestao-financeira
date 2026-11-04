import { Routes } from '@angular/router';

const loadForm = () =>
  import('./account-form-page/account-form-page').then((m) => m.AccountFormPage);

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./account-list-page/account-list-page').then((m) => m.AccountListPage),
  },
  { path: 'new', title: 'Nova conta', loadComponent: loadForm },
  {
    path: ':id',
    title: 'Detalhe da conta',
    loadComponent: () =>
      import('./account-detail-page/account-detail-page').then((m) => m.AccountDetailPage),
  },
  { path: ':id/edit', title: 'Editar conta', loadComponent: loadForm },
];
