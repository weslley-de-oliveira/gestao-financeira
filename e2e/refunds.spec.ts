import { expect, loginAsDemo, test } from './fixtures';

test('refunds part of a card purchase and finds the credit on the invoice', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'O fluxo é o mesmo no celular; o menu de faturas é testado no desktop.');
  await loginAsDemo(page);

  await page.goto('/transactions/new');
  await page.getByRole('radio', { name: 'Cartão de crédito' }).click();
  await page.getByLabel('Descrição').fill('Jaqueta E2E');
  await page.getByLabel('Valor').pressSequentially('20000');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Compras' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.goto('/transactions?busca=jaqueta');
  await page.getByRole('link', { name: 'Jaqueta E2E' }).first().click();
  await page.getByRole('button', { name: 'Registrar estorno' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Valor')).toHaveValue('200,00');
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('5000');
  await dialog.getByRole('button', { name: 'Estornar' }).click();
  await expect(page.getByText(/Valor líquido\s*R\$\s150,00/)).toBeVisible();

  // A compra é de hoje (após o fechamento do dia 3): fatura aberta, que o estorno abate.
  await page.goto('/invoices');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Mês de referência' }).click();
  await page.getByRole('option', { name: /12\/2026/ }).click();
  const refund = page.locator('.invoice__item').filter({ hasText: 'Estorno: Jaqueta E2E' });
  await expect(refund).toContainText(/−R\$\s50,00/);

  // O estorno precisa sair antes da despesa.
  await refund.getByRole('link').click();
  await expect(page.getByText('Estorno de', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByRole('heading', { name: 'Jaqueta E2E' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});
