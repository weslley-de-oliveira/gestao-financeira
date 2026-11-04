import { TestBed } from '@angular/core/testing';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { seedGoals } from '../../../testing/goal-fixtures';
import { InMemoryGoalRepository } from '../../../testing/in-memory-goal.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { InsufficientGoalBalanceError, GoalInput } from './domain/goal-rules';
import { GoalNotFoundError, GoalsFacade } from './goals.facade';

describe('GoalsFacade', () => {
  let facade: GoalsFacade;
  let repository: InMemoryGoalRepository;
  let userId: string;

  const input: GoalInput = {
    name: 'Reserva',
    description: null,
    targetAmount: 1_000_000,
    initialAmount: 200_000,
    deadline: '2027-06-30',
    color: '#2e7d32',
    icon: 'health_and_safety',
  };

  // Hoje: 15/11/2026.
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(GoalsFacade);
    repository = TestBed.inject(InMemoryGoalRepository);
    userId = await signInTestUser();
  });

  it('creates a goal with the progress computed and not stored', async () => {
    const created = await facade.create(input);

    expect(created).toMatchObject({ currentAmount: 200_000, status: 'in-progress', monthsLeft: 8 });
    expect(repository.records[0]).toMatchObject({ userId, contributions: [], isPaused: false });
    expect(repository.records[0]).not.toHaveProperty('currentAmount');
  });

  it('rejects a past deadline on creation but keeps an expired one when editing', async () => {
    await expect(facade.create({ ...input, deadline: '2026-11-14' })).rejects.toMatchObject({
      field: 'deadline',
    });

    const [expired] = seedGoals(userId, { deadline: '2026-10-01' });
    await expect(
      facade.update(expired.id, { ...input, deadline: '2026-10-01', name: 'Renomeada' }),
    ).resolves.toMatchObject({ name: 'Renomeada', status: 'overdue' });
    await expect(
      facade.update(expired.id, { ...input, deadline: '2026-10-02' }),
    ).rejects.toMatchObject({ field: 'deadline' });
  });

  it('registers deposits and withdrawals until the target is reached', async () => {
    const { id } = await facade.create(input);

    await facade.addContribution(id, {
      type: 'deposit',
      amount: 900_000,
      date: '2026-11-10',
      note: 'Bônus',
    });
    const completed = await facade.getById(id);
    expect(completed).toMatchObject({
      currentAmount: 1_100_000,
      status: 'completed',
      excessAmount: 100_000,
    });

    const afterWithdrawal = await facade.addContribution(id, {
      type: 'withdrawal',
      amount: 300_000,
      date: '2026-11-15',
      note: null,
    });
    expect(afterWithdrawal).toMatchObject({ currentAmount: 800_000, status: 'in-progress' });
    expect(repository.records[0].contributions).toHaveLength(2);
  });

  it('never lets the accumulated amount become negative', async () => {
    const { id } = await facade.create({ ...input, initialAmount: 0 });
    const withDeposit = await facade.addContribution(id, {
      type: 'deposit',
      amount: 50_000,
      date: '2026-11-01',
      note: null,
    });

    await expect(
      facade.addContribution(id, {
        type: 'withdrawal',
        amount: 50_001,
        date: '2026-11-02',
        note: null,
      }),
    ).rejects.toBeInstanceOf(InsufficientGoalBalanceError);

    await facade.addContribution(id, {
      type: 'withdrawal',
      amount: 30_000,
      date: '2026-11-02',
      note: null,
    });
    await expect(
      facade.removeContribution(id, withDeposit.contributions[0].id),
    ).rejects.toBeInstanceOf(InsufficientGoalBalanceError);
    await expect(facade.update(id, { ...input, initialAmount: 0 })).resolves.toBeDefined();
  });

  it('pauses, archives and isolates goals by user', async () => {
    const { id } = await facade.create({ ...input, deadline: null });
    seedGoals('someone-else', { name: 'Alheia' });

    expect((await facade.setPaused(id, true)).status).toBe('paused');
    expect((await facade.setArchived(id, true)).isArchived).toBe(true);
    await facade.load();
    expect(facade.goals().map((goal) => goal.name)).toEqual(['Reserva']);
    await expect(facade.setArchived('goal-2', true)).rejects.toBeInstanceOf(GoalNotFoundError);
  });
});
