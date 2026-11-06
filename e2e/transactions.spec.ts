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
  const range = page.locator('.mat-mdc-paginator-range-label');
  const totalOf = async () => Number((await range.textContent())?.trim().split(' de ')[1]);
  await expect(range).toHaveText(/de \d+/);
  const currentMonth = await totalOf();

  await page.getByRole('combobox', { name: 'Período' }).click();
  await page.getByRole('option', { name: 'Últimos 3 meses' }).click();
  // Espera o total dos 3 meses substituir o do mês atual.
  await expect(range).not.toHaveText(new RegExp(` de ${currentMonth}\\s*$`));
  await expect(range).toHaveText(/1–10 de \d+/);
  const total = await totalOf();
  expect(total).toBeGreaterThan(Math.max(10, currentMonth));

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

test('keeps the filters when coming back to the list and after reloading', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Usa as colunas da tabela do desktop.');
  await page.goto('/transactions');
  await page.getByRole('combobox', { name: 'Tipo' }).click();
  await page.getByRole('option', { name: 'Despesas' }).click();
  await page.getByLabel('Buscar na descrição ou observações').fill('farmacia');
  await expect(page).toHaveURL(/busca=farmacia/);
  await expect(page).toHaveURL(/tipo=expense/);

  const descriptions = page.locator('.transactions__table td.mat-column-description');
  await expect(descriptions.first()).toContainText(/farmácia/i);
  const listed = await descriptions.allTextContents();
  await descriptions.first().getByRole('link').click();
  await expect(page).toHaveURL(/\/transactions\/[^?]+$/);

  await page.goBack();
  await expect(page.getByLabel('Buscar na descrição ou observações')).toHaveValue('farmacia');
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toContainText('Despesas');
  await expect(descriptions).toHaveText(listed);

  await page.reload();
  await expect(page.getByLabel('Buscar na descrição ou observações')).toHaveValue('farmacia');
  await expect(descriptions).toHaveText(listed);
});
