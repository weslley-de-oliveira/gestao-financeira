import { apiToday, expect, registerNewUser, test } from './fixtures';

/** `yyyy-MM-dd` deslocada em dias. */
function addDays(isoDate: string, days: number): Date {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

test('pays an invoice in two parts through the API', async ({ page }) => {
  await registerNewUser(page);
  const account = await (
    await page.request.post('/api/v1/accounts', {
      data: { name: 'Conta E2E', type: 'checking', color: '#1565c0', icon: 'account_balance' },
    })
  ).json();
  // A fatura da compra fechou entre 2 e 5 dias atrás (fechamento até o dia 28) e a seguinte ainda
  // não fechou: ela está fechada ou vencida, e pode ser paga.
  const today = apiToday();
  const closingDay = Math.min(addDays(today, -2).getUTCDate(), 28);
  const card = await (
    await page.request.post('/api/v1/credit-cards', {
      data: {
        name: 'Cartão E2E',
        brand: 'visa',
        lastFourDigits: '4321',
        creditLimit: 500_000,
        closingDay,
        dueDay: closingDay <= 21 ? closingDay + 7 : closingDay - 20,
        paymentAccountId: account.id,
        color: '#6a1b9a',
      },
    })
  ).json();
  const categories = await (await page.request.get('/api/v1/categories')).json();
  const purchase = await page.request.post('/api/v1/transactions', {
    data: {
      type: 'expense',
      description: 'Geladeira E2E',
      amount: 30_000,
      date: addDays(today, -20).toISOString().slice(0, 10),
      creditCardId: card.id,
      categoryId: categories.find((item: { name: string }) => item.name === 'Compras').id,
      status: 'completed',
    },
  });
  expect(purchase.status()).toBe(201);
  const invoices = await (
    await page.request.get(`/api/v1/credit-cards/${card.id}/invoices`)
  ).json();
  const closed = invoices.find((item: { status: string }) => item.status !== 'open');
  expect(closed).toMatchObject({ balance: 30_000 });

  await page.goto(`/invoices?creditCardId=${card.id}&month=${closed.referenceMonth}`);
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('10000');
  await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByText(/^Falta pagar R\$\s200,00/)).toBeVisible();

  // Acima do saldo, o diálogo não deixa pagar.
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('30000');
  await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(dialog.getByText(/no máximo R\$ 200,00/)).toBeVisible();
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('20000');
  await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByText('Fatura quitada.')).toBeVisible();

  const invoice = await (
    await page.request.get(`/api/v1/credit-cards/${card.id}/invoices/${closed.referenceMonth}`)
  ).json();
  expect(invoice).toMatchObject({ status: 'paid', paidAmount: 30_000, balance: 0 });
  expect(invoice.payments.map((payment: { amount: number }) => payment.amount)).toEqual([
    20_000, 10_000,
  ]);
  const balance = await (await page.request.get(`/api/v1/accounts/${account.id}`)).json();
  expect(balance.currentBalance).toBe(-30_000);
});
