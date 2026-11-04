import { GoalStatus, GoalWithProgress } from '../../../shared/models/goal';

/** `active`: todas as não arquivadas; os status filtram só entre as não arquivadas. */
export type GoalFilter = 'active' | GoalStatus | 'archived' | 'all';

export const GOAL_FILTER_OPTIONS: readonly { value: GoalFilter; label: string }[] = [
  { value: 'active', label: 'Ativas' },
  { value: 'in-progress', label: 'Em andamento' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'archived', label: 'Arquivadas' },
  { value: 'all', label: 'Todas' },
];

/** Prioridade na listagem: o que pede ação primeiro. */
const STATUS_ORDER: Readonly<Record<GoalStatus, number>> = {
  overdue: 0,
  'in-progress': 1,
  paused: 2,
  completed: 3,
};

/** Filtra e ordena: status, depois prazo mais próximo (sem prazo por último), depois nome. */
export function queryGoals(
  goals: readonly GoalWithProgress[],
  filter: GoalFilter,
): GoalWithProgress[] {
  return goals
    .filter((goal) => {
      switch (filter) {
        case 'all':
          return true;
        case 'archived':
          return goal.isArchived;
        case 'active':
          return !goal.isArchived;
        default:
          return !goal.isArchived && goal.status === filter;
      }
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    );
}
