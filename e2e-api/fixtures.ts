import { Page, expect, test } from '@playwright/test';

/** Conta criada pelo seed da API (`npm run db:seed`). */
export const DEMO = { email: 'demo@exemplo.com', password: 'demo1234' };

export { expect, test };

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Cadastra uma pessoa nova (e-mail único por teste), para não depender dos dados da demo. */
export async function registerNewUser(page: Page): Promise<{ email: string; password: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@exemplo.com`;
  const password = 'senha1234';
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Pessoa Teste');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { email, password };
}

/** Navega pelo menu lateral (aberto no desktop). */
export async function navigate(page: Page, label: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: label, exact: true })
    .click();
}

/**
 * Hoje (`yyyy-MM-dd`) no fuso da API (`TIME_ZONE`, America/Sao_Paulo), e não no da máquina que roda
 * os testes: na CI (UTC), entre 21h e meia-noite de Brasília, as duas datas são diferentes.
 */
export function apiToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
