import { apiToday, expect, registerNewUser, test } from './fixtures';

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

test('anticipates and cancels installments through the API', async ({ page }) => {
  await registerNewUser(page);
  const account = await (
    await page.request.post('/api/v1/accounts', {
      data: { name: 'Conta E2E', type: 'checking', color: '#1565c0', icon: 'account_balance' },
    })
  ).json();
  const card = await (
    await page.request.post('/api/v1/credit-cards', {
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
    })
  ).json();
  const categories = await (await page.request.get('/api/v1/categories')).json();
  const today = apiToday();
  const created = await page.request.post('/api/v1/installment-purchases', {
    data: {
      description: 'Bicicleta E2E',
      amount: 90_000,
      date: today,
      creditCardId: card.id,
      categoryId: categories.find((item: { name: string }) => item.name === 'Compras').id,
      installmentCount: 3,
    },
  });
  expect(created.status()).toBe(201);
  const purchase = await created.json();

  // A 1ª parcela é de hoje, na fatura atual: as outras duas podem ser antecipadas.
  await page.goto(`/transactions/${purchase.installments[0].id}`);
  await page.getByRole('button', { name: 'Antecipar parcelas' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Antecipar' }).click();
  await expect(page.getByText('2 parcelas antecipadas.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Antecipar parcelas' })).toHaveCount(0);
  const anticipated = await (
    await page.request.get(`/api/v1/installment-purchases/${purchase.id}`)
  ).json();
  expect(anticipated.installments.map((item: { date: string }) => item.date)).toEqual([
    today,
    today,
    today,
  ]);

  // Cancelar estorna as três, todas na fatura atual, que fica zerada.
  await page.getByRole('button', { name: 'Cancelar parcelas' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar as parcelas' }).click();
  await expect(page.getByText('Parcelas canceladas.', { exact: true })).toBeVisible();
  await page.goto('/invoices');
  await expect(page.locator('.invoice__item--total')).toContainText(/R\$\s0,00/);
  const usage = await (await page.request.get(`/api/v1/credit-cards/${card.id}`)).json();
  expect(usage.usedLimit).toBe(0);
});
