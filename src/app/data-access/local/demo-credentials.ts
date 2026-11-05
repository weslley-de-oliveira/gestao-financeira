// Sem imports: também é lido pelo script de seed (`scripts/seed.mjs`), executado pelo Node.

/** Conta fictícia criada pelo seed e exibida na tela de login da demo. */
export const DEMO_CREDENTIALS = {
  email: 'demo@exemplo.com',
  password: 'demo1234',
} as const;
