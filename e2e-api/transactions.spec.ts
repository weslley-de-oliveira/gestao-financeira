import { Page } from '@playwright/test';
import { expect, registerNewUser, test } from './fixtures';

/** Hoje no fuso da API (`America/Sao_Paulo`), no formato `yyyy-MM-dd`. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** Cadastra pela API (com a sessão do navegador) uma conta e 12 despesas de R$ 1,00 a R$ 12,00. */
async function seedExpenses(page: Page): Promise<void> {
  const api = page.request;
  const account = await (
    await api.post('/api/v1/accounts', {
      data: { name: 'Conta E2E', type: 'checking', color: '#1565c0', icon: 'account_balance' },
    })
  ).json();
  const categories: { id: string; name: string }[] = await (
    await api.get('/api/v1/categories')
  ).json();
  const food = categories.find((category) => category.name === 'Alimentação');
  for (let index = 1; index <= 12; index++) {
    const response = await api.post('/api/v1/transactions', {
      data: {
        type: 'expense',
        description: index === 7 ? 'Mercado especial' : `Compra ${index}`,
        amount: index * 100,
        date: today(),
        accountId: account.id,
        categoryId: food?.id,
      },
    });
    expect(response.status()).toBe(201);
  }
}

test('pages, sorts and totals the transactions on the server', async ({ page }) => {
  await registerNewUser(page);
  await seedExpenses(page);
  const listRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/transactions')) {
      listRequests.push(`${url.pathname}${url.search}`);
    }
  });

  await page.goto('/transactions');
  const range = page.locator('.mat-mdc-paginator-range-label');
  await expect(range).toHaveText(/1–10 de 12/);
  // Os totais são de todo o resultado, não só da página: 1 + 2 + … + 12 = R$ 78,00.
  await expect(page.getByLabel('Resumo do período filtrado')).toContainText('78,00');

  await page.getByRole('button', { name: 'Próxima página' }).click();
  await expect(range).toHaveText(/11–12 de 12/);
  await expect(page.locator('.transactions__table tr.mat-mdc-row')).toHaveCount(2);

  await page.getByRole('combobox', { name: 'Ordenar por' }).click();
  await page.getByRole('option', { name: 'Maior valor' }).click();
  await expect(range).toHaveText(/1–10 de 12/);
  await expect(page.locator('.transactions__table td.mat-column-amount').first()).toContainText(
    '12,00',
  );

  await page.getByLabel('Buscar na descrição ou observações').fill('ESPECIAL');
  await expect(range).toHaveText(/1–1 de 1/);
  await expect(page.locator('.transactions__table td.mat-column-description')).toHaveText(
    /Mercado especial/,
  );

  // Cada pedido é uma página (com limite) ou o resumo: a lista completa nunca é baixada.
  expect(listRequests.length).toBeGreaterThan(0);
  for (const request of listRequests) {
    expect(request).toMatch(/^\/api\/v1\/transactions(\/summary(\?|$)|\?.*limit=\d+)/);
  }
});
