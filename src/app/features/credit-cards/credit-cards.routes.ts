import { Routes } from '@angular/router';

const loadForm = () =>
  import('./credit-card-form-page/credit-card-form-page').then((m) => m.CreditCardFormPage);

export const CREDIT_CARDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./credit-card-list-page/credit-card-list-page').then((m) => m.CreditCardListPage),
  },
  { path: 'new', title: 'Novo cartão', loadComponent: loadForm },
  {
    path: ':id',
    title: 'Detalhe do cartão',
    loadComponent: () =>
      import('./credit-card-detail-page/credit-card-detail-page').then(
        (m) => m.CreditCardDetailPage,
      ),
  },
  { path: ':id/edit', title: 'Editar cartão', loadComponent: loadForm },
];
