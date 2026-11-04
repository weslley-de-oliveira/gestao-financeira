import { Routes } from '@angular/router';
import { provideMaterialI18n } from '../../core/i18n/material-i18n.providers';

const loadForm = () => import('./goal-form-page/goal-form-page').then((m) => m.GoalFormPage);

export const GOALS_ROUTES: Routes = [
  {
    path: '',
    // Datepicker do prazo e da data dos aportes.
    providers: [provideMaterialI18n()],
    children: [
      {
        path: '',
        loadComponent: () => import('./goal-list-page/goal-list-page').then((m) => m.GoalListPage),
      },
      { path: 'new', title: 'Nova meta', loadComponent: loadForm },
      {
        path: ':id',
        title: 'Detalhe da meta',
        loadComponent: () =>
          import('./goal-detail-page/goal-detail-page').then((m) => m.GoalDetailPage),
      },
      { path: ':id/edit', title: 'Editar meta', loadComponent: loadForm },
    ],
  },
];
