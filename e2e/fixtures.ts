import AxeBuilder from '@axe-core/playwright';
import { Page, expect, test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('../db/db.seed.json', import.meta.url), 'utf8'));

/** Conta criada pelo seed (mesmos valores de `src/app/data-access/local/demo-credentials.ts`). */
export const DEMO_EMAIL = seed.users[0].email as string;

/**
 * "Hoje" dos testes: a data de referência do seed, ao meio-dia. Assim o seed não é deslocado e
 * as faturas, orçamentos e metas ficam sempre no mesmo estado, qualquer que seja a data real.
 */
export const TODAY = new Date(`${seed.meta.anchorDate}T12:00:00-03:00`);

export const test = base.extend<{ fixedClock: void }>({
  fixedClock: [
    async ({ page }, use) => {
      await page.clock.setFixedTime(TODAY);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export async function loginAsDemo(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar com a conta de demonstração' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Olá');
}

/** Navega pelo menu lateral (aberto no desktop; no celular, pelo botão de menu). */
export async function navigate(page: Page, label: string): Promise<void> {
  const link = page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: label, exact: true });
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Alternar menu lateral' }).click();
  }
  await link.click();
}

/** Espera os indicadores de carregamento ("Carregando …") sumirem. */
export async function waitForContent(page: Page): Promise<void> {
  await expect(page.getByRole('progressbar', { name: /^Carregando/ })).toHaveCount(0);
}

/** Verificação automática de acessibilidade (WCAG 2.1 A e AA) da página atual. */
export async function expectAccessible(page: Page): Promise<void> {
  await waitForContent(page);
  // Espera as animações de entrada do Material assentarem.
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `  - ${node.target.join(' ')}`).join('\n'),
  );
  expect(summary, summary.join('\n')).toEqual([]);
}
