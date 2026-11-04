/** Opção de cor ou ícone de identificação (contas, categorias etc.). */
export interface AppearanceOption {
  value: string;
  label: string;
}

/** Cores de identificação: dados escolhidos pelo usuário, não tokens do tema. */
export const APPEARANCE_COLORS: readonly AppearanceOption[] = [
  { value: '#1565c0', label: 'Azul' },
  { value: '#2e7d32', label: 'Verde' },
  { value: '#6a1b9a', label: 'Roxo' },
  { value: '#c62828', label: 'Vermelho' },
  { value: '#ef6c00', label: 'Laranja' },
  { value: '#00838f', label: 'Ciano' },
  { value: '#ad1457', label: 'Rosa' },
  { value: '#546e7a', label: 'Cinza' },
];

export function isAppearanceOption(options: readonly AppearanceOption[], value: string): boolean {
  return options.some((option) => option.value === value);
}
