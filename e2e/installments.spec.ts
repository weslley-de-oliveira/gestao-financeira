import { expect, loginAsDemo, test } from './fixtures';

test('records a card purchase in installments, finds them on the invoices and deletes it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'O fluxo é o mesmo no celular; o menu de faturas é testado no desktop.');
  await loginAsDemo(page);

  await page.goto('/transactions/new');
  await page.getByRole('radio', { name: 'Cartão de crédito' }).click();
  await page.getByLabel('Descrição').fill('Televisão E2E');
  await page.getByLabel('Valor').pressSequentially('90000');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Compras' }).click();
  await page.getByRole('combobox', { name: 'Parcelas' }).click();
  await page.getByRole('option', { name: '3x', exact: true }).click();
  await expect(page.getByText(/Parcelas de R\$\s300,00; a última na fatura de/)).toBeVisible();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  // A compra é de hoje (após o fechamento do dia 3): parcelas de dezembro a fevereiro.
  await page.goto('/invoices');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Mês de referência' }).click();
  await page.getByRole('option', { name: /02\/2027/ }).click();
  const item = page.locator('.invoice__item').filter({ hasText: 'Televisão E2E' });
  await expect(item).toContainText('Parcela 3 de 3');
  await expect(item).toContainText('300,00');

  await item.getByRole('link', { name: /Televisão E2E/ }).click();
  await expect(page.getByText('Parcela 3 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Excluir a compra' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir a compra' }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.goto('/transactions?busca=televis');
  await expect(
    page.getByText('Nenhuma transação no período e nos filtros selecionados.'),
  ).toBeVisible();
});
