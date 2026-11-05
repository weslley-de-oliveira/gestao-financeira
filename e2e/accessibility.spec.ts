import { expect, expectAccessible, loginAsDemo, test } from './fixtures';

const PUBLIC_PAGES = ['/login', '/register'];

const PRIVATE_PAGES = [
  '/dashboard',
  '/accounts',
  '/accounts/new',
  '/transactions',
  '/transactions/new',
  '/categories',
  '/budgets',
  '/goals',
  '/credit-cards',
  '/invoices',
  '/settings',
  '/security',
];

for (const url of PUBLIC_PAGES) {
  test(`${url} has no automatically detectable accessibility issues`, async ({ page }) => {
    await page.goto(url);
    await expectAccessible(page);
  });
}

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  for (const url of PRIVATE_PAGES) {
    test(`${url} has no automatically detectable accessibility issues`, async ({ page }) => {
      await page.goto(url);
      await expectAccessible(page);
    });
  }

  for (const url of ['/dashboard', '/transactions', '/invoices']) {
    test(`${url} is accessible in the dark theme`, async ({ page }) => {
      await page.getByRole('button', { name: 'Usar tema escuro' }).click();
      await page.goto(url);
      await expectAccessible(page);
    });
  }
});

const ACCENTS = ['navy', 'azure', 'cyan', 'green', 'violet', 'rose', 'orange'];

for (const accent of ACCENTS) {
  test(`the ${accent} accent palette is accessible`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem('gf.preferences', JSON.stringify({ accent: value }));
    }, accent);
    await loginAsDemo(page);
    await expect(page.locator('html')).toHaveClass(new RegExp(`accent-${accent}`));
    await expectAccessible(page);
  });
}
