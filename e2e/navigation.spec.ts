import { expect, loginAsDemo, navigate, test } from './fixtures';

const PAGES = [
  { label: 'Contas', heading: 'Contas', url: '/accounts' },
  { label: 'Transações', heading: 'Transações', url: '/transactions' },
  { label: 'Categorias', heading: 'Categorias', url: '/categories' },
  { label: 'Orçamentos', heading: 'Orçamentos', url: '/budgets' },
  { label: 'Metas', heading: 'Metas', url: '/goals' },
  { label: 'Cartões de crédito', heading: 'Cartões de crédito', url: '/credit-cards' },
  { label: 'Faturas', heading: 'Faturas', url: '/invoices' },
  { label: 'Configurações', heading: 'Configurações', url: '/settings' },
  { label: 'Segurança', heading: 'Segurança e privacidade', url: '/security' },
  { label: 'Dashboard', heading: 'Olá', url: '/dashboard' },
];

test('redirects to the login and back to the requested page', async ({ page }) => {
  await page.goto('/goals');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fgoals$/);

  await page.getByRole('button', { name: 'Entrar com a conta de demonstração' }).click();

  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Metas');
});

test('navigates through every page of the side menu', async ({ page }) => {
  await loginAsDemo(page);

  for (const { label, heading, url } of PAGES) {
    await navigate(page, label);
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    await expect(page).toHaveTitle(/Gestão Financeira/);
  }
});

test('shows the not found page for unknown addresses', async ({ page }) => {
  await loginAsDemo(page);

  await page.goto('/endereco-inexistente');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/não encontrada/i).first()).toBeVisible();
});
