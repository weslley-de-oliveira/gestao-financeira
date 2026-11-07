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

test('anticipates the last installment and cancels the ones not charged yet', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'O fluxo é o mesmo no celular; o menu de faturas é testado no desktop.');
  await loginAsDemo(page);

  await page.goto('/transactions/new');
  await page.getByRole('radio', { name: 'Cartão de crédito' }).click();
  await page.getByLabel('Descrição').fill('Notebook E2E');
  await page.getByLabel('Valor').pressSequentially('90000');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Compras' }).click();
  await page.getByRole('combobox', { name: 'Parcelas' }).click();
  await page.getByRole('option', { name: '3x', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  // A compra é de hoje (após o fechamento do dia 3): a fatura atual é a de 12/2026.
  await page.goto('/transactions?busca=notebook');
  await page
    .getByRole('link', { name: /Notebook E2E/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Antecipar parcelas' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('fatura de dezembro de 2026');
  await dialog.getByRole('combobox', { name: 'Parcelas a antecipar' }).click();
  await page.getByRole('option', { name: 'A última parcela' }).click();
  await dialog.getByRole('button', { name: 'Antecipar' }).click();
  await expect(page.getByText('Parcela antecipada.', { exact: true })).toBeVisible();

  await page.goto('/invoices');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Mês de referência' }).click();
  await page.getByRole('option', { name: /12\/2026/ }).click();
  const items = page.locator('.invoice__item').filter({ hasText: 'Notebook E2E' });
  await expect(items.filter({ hasText: 'Parcela 1 de 3' })).toHaveCount(1);
  await expect(items.filter({ hasText: 'Parcela 3 de 3' })).toHaveCount(1);

  // Cancelar estorna as duas parcelas da fatura atual e a 2ª, na fatura de 01/2027.
  await items.filter({ hasText: 'Parcela 1 de 3' }).getByRole('link').click();
  await page.getByRole('button', { name: 'Cancelar parcelas' }).click();
  await expect(page.getByRole('dialog')).toContainText(/3 parcelas .* \(R\$\s900,00\)/);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar as parcelas' }).click();
  await expect(page.getByText('Parcelas canceladas.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar parcelas' })).toHaveCount(0);
  await expect(page.getByText('Cancelamento: Notebook E2E (1/3)')).toBeVisible();
});
