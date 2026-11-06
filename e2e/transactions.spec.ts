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

test('pages, sorts and searches the transactions of the period', async ({ page, isMobile }) => {
  // No celular a lista não é tabela; a paginação é a mesma.
  test.skip(isMobile, 'Verifica as colunas da tabela do desktop.');
  await page.goto('/transactions');
  await page.getByRole('combobox', { name: 'Período' }).click();
  await page.getByRole('option', { name: 'Últimos 3 meses' }).click();

  const range = page.locator('.mat-mdc-paginator-range-label');
  await expect(range).toHaveText(/1–10 de \d+/);
  const total = Number((await range.textContent())?.trim().split(' de ')[1]);
  expect(total).toBeGreaterThan(10);

  await page.getByRole('button', { name: 'Próxima página' }).click();
  await expect(range).toHaveText(`11–${Math.min(20, total)} de ${total}`);
  await page.getByRole('button', { name: 'Página anterior' }).click();
  await expect(range).toHaveText(`1–10 de ${total}`);

  // Ordenar volta à primeira página, com o maior valor no topo.
  await page.getByRole('combobox', { name: 'Ordenar por' }).click();
  await page.getByRole('option', { name: 'Maior valor' }).click();
  await expect(page.getByLabel('Atualizando transações')).toBeHidden();
  const amounts = page.locator('.transactions__table td.mat-column-amount');
  await expect(amounts.first()).toBeVisible();
  const values = (await amounts.allTextContents()).map((text) =>
    Number(text.replace(/[^\d,]/g, '').replace(',', '.')),
  );
  expect(values).toEqual([...values].sort((a, b) => b - a));

  await page.getByLabel('Buscar na descrição ou observações').fill('mercado');
  await expect(range).not.toHaveText(`1–10 de ${total}`);
  await expect(page.getByLabel('Atualizando transações')).toBeHidden();
  const descriptions = page.locator('.transactions__table td.mat-column-description');
  for (const text of await descriptions.allTextContents()) {
    expect(text.toLowerCase()).toContain('mercado');
  }
});
