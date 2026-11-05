import { expect, loginAsDemo, navigate, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await loginAsDemo(page);
});

test('records an expense and updates the account balance', async ({ page }) => {
  await navigate(page, 'Contas');
  const checking = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: 'Conta corrente', exact: true }) });
  await expect(checking).toContainText('R$');
  const balanceBefore = await checking.textContent();

  await navigate(page, 'Transações');
  await page.getByRole('link', { name: 'Nova transação' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nova transação');

  await page.getByLabel('Descrição').fill('Jantar de teste E2E');
  // A máscara preenche da direita para a esquerda: 8 9 9 0 → 89,90.
  await page.getByLabel('Valor').pressSequentially('8990');
  await expect(page.getByLabel('Valor')).toHaveValue('89,90');
  await page.getByRole('combobox', { name: 'Conta' }).click();
  await page.getByRole('option', { name: /Conta corrente/ }).click();
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Alimentação' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText('Jantar de teste E2E').first()).toBeVisible();

  await navigate(page, 'Contas');
  await expect(checking).toContainText('R$');
  await expect(checking).not.toHaveText(balanceBefore ?? '');
});

test('validates the required fields', async ({ page }) => {
  await page.goto('/transactions/new');

  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByText('Informe a descrição.')).toBeVisible();
  await expect(page).toHaveURL(/\/transactions\/new$/);
});
