import { Routes } from '@angular/router';

const loadForm = () => import('./budget-form-page/budget-form-page').then((m) => m.BudgetFormPage);

export const BUDGETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./budget-list-page/budget-list-page').then((m) => m.BudgetListPage),
  },
  { path: 'new', title: 'Novo orçamento', loadComponent: loadForm },
  { path: ':id/edit', title: 'Editar orçamento', loadComponent: loadForm },
];
