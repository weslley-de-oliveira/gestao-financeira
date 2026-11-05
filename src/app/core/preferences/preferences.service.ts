import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DENSITY_PREFERENCES = ['default', 'compact'] as const;
export type DensityPreference = (typeof DENSITY_PREFERENCES)[number];

export const ACCENT_PREFERENCES = [
  'navy',
  'azure',
  'cyan',
  'green',
  'violet',
  'rose',
  'orange',
] as const;
/** Cor de destaque: paleta do tema (botões, links, barra lateral), nos temas claro e escuro. */
export type AccentPreference = (typeof ACCENT_PREFERENCES)[number];

export interface AccentOption {
  value: AccentPreference;
  label: string;
  /** Amostra exibida no seletor: o tom principal da paleta no tema claro. */
  swatch: string;
}

/** Paletas em `styles.scss` (`$accents`); a primeira é a padrão. */
export const ACCENT_OPTIONS: readonly AccentOption[] = [
  { value: 'navy', label: 'Azul-marinho', swatch: '#29457e' },
  { value: 'azure', label: 'Azul', swatch: '#005cbb' },
  { value: 'cyan', label: 'Turquesa', swatch: '#006a6a' },
  { value: 'green', label: 'Verde', swatch: '#026e00' },
  { value: 'violet', label: 'Roxo', swatch: '#7d00fa' },
  { value: 'rose', label: 'Rosa', swatch: '#ba005c' },
  { value: 'orange', label: 'Laranja', swatch: '#964900' },
];

export interface Preferences {
  theme: ThemePreference;
  density: DensityPreference;
  accent: AccentPreference;
}

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  theme: 'system',
  density: 'default',
  accent: 'navy',
};

/** Chave no localStorage. Guarda só preferências visuais, nunca dados pessoais ou segredos. */
export const PREFERENCES_STORAGE_KEY = 'gf.preferences';

const DARK_THEME_CLASS = 'dark-theme';
const COMPACT_DENSITY_CLASS = 'compact-density';
const ACCENT_CLASS_PREFIX = 'accent-';

/**
 * Preferências visuais locais ao navegador. O tema "sistema" acompanha ao vivo a preferência do
 * sistema operacional. Aplicadas como classes no `<html>` (o tema usa `light-dark()`; a cor de
 * destaque troca a paleta do Material).
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly _preferences = signal<Preferences>(this.read());
  private readonly systemPrefersDark = signal(false);

  readonly theme = computed(() => this._preferences().theme);
  readonly density = computed(() => this._preferences().density);
  readonly accent = computed(() => this._preferences().accent);
  /** Tema efetivamente aplicado. */
  readonly effectiveTheme = computed<'light' | 'dark'>(() => {
    const theme = this.theme();
    return theme === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : theme;
  });

  constructor() {
    this.watchSystemTheme();
    effect(() => {
      const root = this.document.documentElement;
      root.classList.toggle(DARK_THEME_CLASS, this.effectiveTheme() === 'dark');
      root.classList.toggle(COMPACT_DENSITY_CLASS, this.density() === 'compact');
      for (const accent of ACCENT_PREFERENCES) {
        root.classList.toggle(ACCENT_CLASS_PREFIX + accent, this.accent() === accent);
      }
    });
  }

  setTheme(theme: ThemePreference): void {
    this.update({ theme });
  }

  setDensity(density: DensityPreference): void {
    this.update({ density });
  }

  setAccent(accent: AccentPreference): void {
    this.update({ accent });
  }

  /** Atalho da barra superior: fixa o tema oposto ao que está aplicado. */
  toggleTheme(): void {
    this.setTheme(this.effectiveTheme() === 'dark' ? 'light' : 'dark');
  }

  /** Volta ao padrão e apaga o que foi salvo neste navegador. */
  reset(): void {
    this._preferences.set({ ...DEFAULT_PREFERENCES });
    try {
      localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {
      // Sem acesso ao localStorage: nada a apagar.
    }
  }

  private update(changes: Partial<Preferences>): void {
    const next = { ...this._preferences(), ...changes };
    this._preferences.set(next);
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sem localStorage (modo privado, cota): a preferência vale só nesta visita.
    }
  }

  /** Lê o que foi salvo, descartando valores desconhecidos. */
  private read(): Preferences {
    try {
      const saved = JSON.parse(
        localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null',
      ) as Partial<Preferences> | null;
      return {
        theme:
          THEME_PREFERENCES.find((value) => value === saved?.theme) ?? DEFAULT_PREFERENCES.theme,
        density:
          DENSITY_PREFERENCES.find((value) => value === saved?.density) ??
          DEFAULT_PREFERENCES.density,
        accent:
          ACCENT_PREFERENCES.find((value) => value === saved?.accent) ?? DEFAULT_PREFERENCES.accent,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private watchSystemTheme(): void {
    const view = this.document.defaultView;
    if (!view?.matchMedia) {
      return;
    }
    const query = view.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark.set(query.matches);
    const listener = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
    query.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
  }
}
