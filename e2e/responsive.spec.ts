import { Page } from '@playwright/test';
import { expect, loginAsDemo, navigate, test, waitForContent } from './fixtures';

/** Executado no projeto `mobile` (Pixel 7): menu recolhido e sem rolagem horizontal. */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  await waitForContent(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('fits the login page on a phone screen', async ({ page }) => {
  await page.goto('/login');
  await expectNoHorizontalScroll(page);
});

test('navigates through the collapsed menu and fits every page on a phone', async ({ page }) => {
  await loginAsDemo(page);
  const menu = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(menu).toBeHidden();
  await expectNoHorizontalScroll(page);

  for (const label of [
    'Contas',
    'Transações',
    'Categorias',
    'Orçamentos',
    'Metas',
    'Cartões de crédito',
    'Faturas',
    'Configurações',
    'Segurança',
  ]) {
    await navigate(page, label);
    await expect(menu).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});
