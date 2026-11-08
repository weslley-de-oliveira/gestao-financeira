import { Goal, GoalContribution, GoalWithProgress } from '../../../shared/models/goal';
import { queryGoals } from './goal-query';
import {
  ContributionInput,
  GoalInput,
  InvalidGoalInputError,
  calculateGoalProgress,
  goalBalance,
  goalProgressBarValue,
  goalStatus,
  normalizeContributionInput,
  normalizeGoalInput,
} from './goal-rules';

const TODAY = '2026-11-15';

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.name ?? 'goal',
    userId: 'user',
    name: 'Viagem',
    description: null,
    targetAmount: 1_000_000,
    initialAmount: 100_000,
    contributions: [],
    deadline: null,
    color: '#2e7d32',
    icon: 'flight',
    isPaused: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function contribution(overrides: Partial<GoalContribution>): GoalContribution {
  return {
    id: crypto.randomUUID(),
    type: 'deposit',
    accountId: null,
    amount: 10_000,
    date: '2026-11-01',
    note: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

function fieldOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof InvalidGoalInputError) {
      return error.field;
    }
    throw error;
  }
  return undefined;
}

describe('goal rules', () => {
  it('accumulates the initial amount, deposits and withdrawals', () => {
    expect(
      goalBalance(
        goal({
          contributions: [
            contribution({ amount: 50_000 }),
            contribution({ type: 'withdrawal', amount: 20_000 }),
          ],
        }),
      ),
    ).toBe(130_000);
  });

  it('derives the status: completed > paused > overdue > in progress', () => {
    const base = { targetAmount: 100, deadline: '2026-11-14', isPaused: false };

    expect(goalStatus(base, 100, TODAY)).toBe('completed');
    expect(goalStatus({ ...base, isPaused: true }, 100, TODAY)).toBe('completed');
    expect(goalStatus({ ...base, isPaused: true }, 50, TODAY)).toBe('paused');
    expect(goalStatus(base, 50, TODAY)).toBe('overdue');
    expect(goalStatus({ ...base, deadline: TODAY }, 50, TODAY)).toBe('in-progress');
    expect(goalStatus({ ...base, deadline: null }, 50, TODAY)).toBe('in-progress');
  });

  it('computes remaining amount and the monthly pace counting the current month', () => {
    const progress = calculateGoalProgress(
      goal({ deadline: '2027-04-30', contributions: [contribution({ amount: 100_000 })] }),
      TODAY,
    );

    expect(progress).toMatchObject({
      currentAmount: 200_000,
      remainingAmount: 800_000,
      excessAmount: 0,
      percent: 20,
      status: 'in-progress',
      monthsLeft: 6,
      // 800.000 / 6 = 133.333,33… → arredondado para cima.
      monthlyPace: 133_334,
    });
  });

  it('keeps the excess and clamps only the progress bar', () => {
    const progress = calculateGoalProgress(goal({ initialAmount: 1_250_000 }), TODAY);

    expect(progress).toMatchObject({
      status: 'completed',
      remainingAmount: 0,
      excessAmount: 250_000,
      percent: 125,
      monthlyPace: null,
    });
    expect(goalProgressBarValue(progress)).toBe(100);
  });

  it('has no pace without deadline or after it', () => {
    expect(calculateGoalProgress(goal({}), TODAY).monthlyPace).toBeNull();
    expect(calculateGoalProgress(goal({ deadline: '2026-10-01' }), TODAY)).toMatchObject({
      status: 'overdue',
      monthsLeft: null,
      monthlyPace: null,
    });
    expect(
      calculateGoalProgress(goal({ deadline: '2026-10-01', isPaused: true }), TODAY).monthlyPace,
    ).toBeNull();
    expect(calculateGoalProgress(goal({ deadline: '2026-11-30' }), TODAY)).toMatchObject({
      monthsLeft: 1,
      monthlyPace: 900_000,
    });
  });

  it('validates the goal input', () => {
    const input: GoalInput = {
      name: '  Viagem   ao Japão ',
      description: '   ',
      targetAmount: 1_000_000,
      initialAmount: 0,
      deadline: null,
      color: '#2e7d32',
      icon: 'flight',
    };

    expect(normalizeGoalInput(input)).toMatchObject({ name: 'Viagem ao Japão', description: null });
    expect(fieldOf(() => normalizeGoalInput({ ...input, name: ' ' }))).toBe('name');
    expect(fieldOf(() => normalizeGoalInput({ ...input, targetAmount: 0 }))).toBe('targetAmount');
    expect(fieldOf(() => normalizeGoalInput({ ...input, initialAmount: -1 }))).toBe(
      'initialAmount',
    );
    expect(fieldOf(() => normalizeGoalInput({ ...input, initialAmount: 1.5 }))).toBe(
      'initialAmount',
    );
    expect(fieldOf(() => normalizeGoalInput({ ...input, deadline: '2026-02-30' }))).toBe(
      'deadline',
    );
    expect(fieldOf(() => normalizeGoalInput({ ...input, icon: 'x' }))).toBe('icon');
  });

  it('validates contributions: positive amount and no future date', () => {
    const input: ContributionInput = {
      type: 'deposit',
      amount: 10_000,
      accountId: null,
      date: TODAY,
      note: '  ',
    };

    expect(normalizeContributionInput(input, TODAY).note).toBeNull();
    expect(fieldOf(() => normalizeContributionInput({ ...input, amount: 0 }, TODAY))).toBe(
      'amount',
    );
    expect(fieldOf(() => normalizeContributionInput({ ...input, date: '2026-11-16' }, TODAY))).toBe(
      'date',
    );
  });

  it('lists what needs attention first', () => {
    const today = (g: Goal): GoalWithProgress => calculateGoalProgress(g, TODAY);
    const goals = [
      today(goal({ name: 'Sem prazo' })),
      today(goal({ name: 'Concluída', initialAmount: 1_000_000 })),
      today(goal({ name: 'Atrasada', deadline: '2026-10-01' })),
      today(goal({ name: 'Próxima', deadline: '2026-12-01' })),
      today(goal({ name: 'Pausada', isPaused: true })),
      today(goal({ name: 'Arquivada', isArchived: true })),
    ];

    expect(queryGoals(goals, 'active').map((g) => g.name)).toEqual([
      'Atrasada',
      'Próxima',
      'Sem prazo',
      'Pausada',
      'Concluída',
    ]);
    expect(queryGoals(goals, 'archived').map((g) => g.name)).toEqual(['Arquivada']);
    expect(queryGoals(goals, 'completed').map((g) => g.name)).toEqual(['Concluída']);
    expect(queryGoals(goals, 'all')).toHaveLength(6);
  });
});
