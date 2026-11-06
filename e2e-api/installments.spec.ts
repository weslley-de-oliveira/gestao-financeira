import { expect, registerNewUser, test } from './fixtures';

test('records a card purchase in installments through the API and deletes it', async ({ page }) => {
  await registerNewUser(page);
  const account = await (
    await page.request.post('/api/v1/accounts', {
      data: { name: 'Conta E2E', type: 'checking', color: '#1565c0', icon: 'account_balance' },
    })
  ).json();
  const card = await page.request.post('/api/v1/credit-cards', {
    data: {
      name: 'Cartão E2E',
      brand: 'visa',
      lastFourDigits: '4321',
      creditLimit: 500_000,
      closingDay: 5,
      dueDay: 12,
      paymentAccountId: account.id,
      color: '#6a1b9a',
    },
  });
  expect(card.status()).toBe(201);

  await page.goto('/transactions/new');
  await page.getByRole('radio', { name: 'Cartão de crédito' }).click();
  await page.getByLabel('Descrição').fill('Sofá E2E');
  await page.getByLabel('Valor').pressSequentially('100000');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão E2E/ }).click();
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Moradia' }).click();
  await page.getByRole('combobox', { name: 'Parcelas' }).click();
  await page.getByRole('option', { name: '3x', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  // As faturas vêm da API, da mais recente (a da 3ª parcela) para a mais antiga.
  await page.goto('/invoices');
  await page.getByRole('combobox', { name: 'Mês de referência' }).click();
  await page.getByRole('option').first().click();
  const item = page.locator('.invoice__item').filter({ hasText: 'Sofá E2E' });
  await expect(item).toContainText('Parcela 3 de 3');
  await expect(item).toContainText('333,33');

  await item.getByRole('link', { name: /Sofá E2E/ }).click();
  await page.getByRole('button', { name: 'Excluir a compra' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir a compra' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  const purchases = await (await page.request.get('/api/v1/transactions?q=sofa')).json();
  expect(purchases.items).toEqual([]);
});
