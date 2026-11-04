import { Routes } from '@angular/router';

const loadForm = () =>
  import('./category-form-page/category-form-page').then((m) => m.CategoryFormPage);

export const CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./category-list-page/category-list-page').then((m) => m.CategoryListPage),
  },
  { path: 'new', title: 'Nova categoria', loadComponent: loadForm },
  { path: ':id/edit', title: 'Editar categoria', loadComponent: loadForm },
];
