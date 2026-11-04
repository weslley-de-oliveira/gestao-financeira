import { TestBed } from '@angular/core/testing';
import { PREFERENCES_STORAGE_KEY, PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let systemDark: boolean;
  let listeners: ((event: { matches: boolean }) => void)[];

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-theme', 'compact-density');
    systemDark = false;
    listeners = [];
    // O ambiente de testes não implementa matchMedia: simula a preferência do sistema.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('dark') && systemDark,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark-theme', 'compact-density');
  });

  function create(): PreferencesService {
    const service = TestBed.inject(PreferencesService);
    TestBed.tick();
    return service;
  }

  function classes(): string[] {
    return [...document.documentElement.classList];
  }

  it('follows the system theme by default, live', () => {
    systemDark = true;
    const service = create();

    expect(service.theme()).toBe('system');
    expect(classes()).toContain('dark-theme');

    listeners.forEach((listener) => listener({ matches: false }));
    TestBed.tick();
    expect(service.effectiveTheme()).toBe('light');
    expect(classes()).not.toContain('dark-theme');
  });

  it('applies and saves the chosen theme and density', () => {
    const service = create();

    service.setTheme('dark');
    service.setDensity('compact');
    TestBed.tick();

    expect(classes()).toEqual(expect.arrayContaining(['dark-theme', 'compact-density']));
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY)!)).toEqual({
      theme: 'dark',
      density: 'compact',
    });
  });

  it('restores saved preferences and ignores unknown values', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ theme: 'neon', density: 'compact', name: 'x' }),
    );

    const service = create();

    expect(service.theme()).toBe('system');
    expect(service.density()).toBe('compact');
  });

  it('toggles to the opposite of the applied theme', () => {
    systemDark = true;
    const service = create();

    service.toggleTheme();
    expect(service.theme()).toBe('light');
    service.toggleTheme();
    expect(service.theme()).toBe('dark');
  });

  it('resets to the defaults and forgets what was saved', () => {
    const service = create();
    service.setDensity('compact');

    service.reset();
    TestBed.tick();

    expect(service.density()).toBe('default');
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(classes()).not.toContain('compact-density');
  });
});
