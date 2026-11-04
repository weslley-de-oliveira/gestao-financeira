import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { signInTestUser } from '../../../testing/auth-fixtures';
import { InMemoryCategoryRepository } from '../../../testing/in-memory-category.repository';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { CategoriesFacade, CategoryNotFoundError } from './categories.facade';
import { CategoryInput, DuplicateCategoryNameError } from './domain/category-rules';
import { DEFAULT_CATEGORIES } from './domain/default-categories';

describe('CategoriesFacade', () => {
  let facade: CategoriesFacade;
  let repository: InMemoryCategoryRepository;
  let userId: string;

  const input: CategoryInput = {
    name: '  Pets ',
    type: 'expense',
    icon: 'pets',
    color: '#ef6c00',
    isArchived: false,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    facade = TestBed.inject(CategoriesFacade);
    repository = TestBed.inject(InMemoryCategoryRepository);
    userId = await signInTestUser();
  });

  it('creates the default categories on the first load only once', async () => {
    await Promise.all([facade.load(), facade.load()]);
    await facade.load();

    expect(facade.status()).toBe('ready');
    expect(repository.records).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(repository.records.every((c) => c.userId === userId && c.isDefault)).toBe(true);
    expect(facade.categories()).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it('does not recreate defaults when the user already has categories', async () => {
    await facade.create(input);

    await facade.load();

    expect(facade.categories().map((c) => c.name)).toEqual(['Pets']);
  });

  it('creates a custom category with a normalized name', async () => {
    const created = await facade.create(input);

    expect(created).toMatchObject({ name: 'Pets', userId, isDefault: false, isArchived: false });
  });

  it('prevents duplicate names for the same type, including archived ones', async () => {
    const pets = await facade.create(input);
    await facade.setArchived(pets.id, true);

    await expect(facade.create({ ...input, name: 'PETS' })).rejects.toBeInstanceOf(
      DuplicateCategoryNameError,
    );
    await expect(facade.create({ ...input, type: 'income' })).resolves.toMatchObject({
      type: 'income',
    });
  });

  it('updates name, icon and color but never the type', async () => {
    const pets = await facade.create(input);
    const other = await facade.create({ ...input, name: 'Viagem', icon: 'flight' });

    await expect(facade.update(other.id, { ...input, name: 'pets' })).rejects.toBeInstanceOf(
      DuplicateCategoryNameError,
    );
    const updated = await facade.update(pets.id, {
      name: 'Animais',
      icon: 'pets',
      color: '#1565c0',
      isArchived: false,
      // @ts-expect-error o tipo não faz parte da edição
      type: 'income',
    });

    expect(updated).toMatchObject({ name: 'Animais', color: '#1565c0', type: 'expense' });
  });

  it('archives without removing the category', async () => {
    const pets = await facade.create(input);

    await facade.setArchived(pets.id, true);

    expect(repository.records).toEqual([
      expect.objectContaining({ id: pets.id, isArchived: true }),
    ]);
  });

  it('does not change categories of other users', async () => {
    repository.records.push({
      ...input,
      id: 'other',
      userId: 'someone-else',
      isDefault: false,
      createdAt: new Date().toISOString(),
    });

    await expect(facade.setArchived('other', true)).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(await facade.getById('other')).toBeNull();
  });

  it('exposes an error status when loading fails', async () => {
    vi.spyOn(repository, 'listByUser').mockReturnValue(throwError(() => new Error('offline')));

    await facade.load();

    expect(facade.status()).toBe('error');
  });
});
