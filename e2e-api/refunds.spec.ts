import { expect, registerNewUser, test } from './fixtures';

test('refunds a card purchase through the API and shows the credit on the invoice', async ({
  page,
}) => {
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
  const today = new Date().toLocaleDateString('sv-SE');
  const purchase = await page.request.post('/api/v1/transactions', {
    data: {
      type: 'expense',
      description: 'Tênis E2E',
      amount: 30_000,
      date: today,
      creditCardId: card.id,
      categoryId: categories.find((item: { name: string }) => item.name === 'Compras').id,
      status: 'completed',
    },
  });
  expect(purchase.status()).toBe(201);

  await page.goto(`/transactions/${(await purchase.json()).id}`);
  await page.getByRole('button', { name: 'Registrar estorno' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('10000');
  await dialog.getByRole('button', { name: 'Estornar' }).click();
  await expect(page.getByText(/Valor líquido\s*R\$\s200,00/)).toBeVisible();

  // A fatura aberta hoje tem a compra e o estorno; o limite usado é o líquido.
  await page.goto('/invoices');
  await expect(
    page.locator('.invoice__item').filter({ hasText: 'Estorno: Tênis E2E' }),
  ).toContainText(/−R\$\s100,00/);
  await expect(page.locator('.invoice__item--total')).toContainText(/R\$\s200,00/);
  const usage = await (await page.request.get(`/api/v1/credit-cards/${card.id}`)).json();
  expect(usage.usedLimit).toBe(20_000);

  // A despesa com estorno não é excluída: a API responde 409 e a tela explica.
  await page.goto(`/transactions/${(await purchase.json()).id}`);
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText(/Esta despesa tem estornos/)).toBeVisible();
});
