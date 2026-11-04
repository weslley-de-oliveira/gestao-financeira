import { Routes } from '@angular/router';
import { provideMaterialI18n } from '../../core/i18n/material-i18n.providers';

const loadForm = () =>
  import('./transaction-form-page/transaction-form-page').then((m) => m.TransactionFormPage);

export const TRANSACTIONS_ROUTES: Routes = [
  {
    path: '',
    providers: [provideMaterialI18n()],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./transaction-list-page/transaction-list-page').then(
            (m) => m.TransactionListPage,
          ),
      },
      { path: 'new', title: 'Nova transação', loadComponent: loadForm },
      {
        path: ':id',
        title: 'Detalhe da transação',
        loadComponent: () =>
          import('./transaction-detail-page/transaction-detail-page').then(
            (m) => m.TransactionDetailPage,
          ),
      },
      { path: ':id/edit', title: 'Editar transação', loadComponent: loadForm },
    ],
  },
];
