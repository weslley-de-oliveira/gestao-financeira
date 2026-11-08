import { expect, registerNewUser, test } from './fixtures';

test('saves money from an account in a goal through the API and undoes it', async ({ page }) => {
  await registerNewUser(page);
  const account = await (
    await page.request.post('/api/v1/accounts', {
      data: {
        name: 'Conta E2E',
        type: 'checking',
        initialBalance: 100_000,
        color: '#1565c0',
        icon: 'account_balance',
      },
    })
  ).json();
  const goal = await (
    await page.request.post('/api/v1/goals', {
      data: { name: 'Viagem E2E', targetAmount: 500_000, color: '#2e7d32', icon: 'flight' },
    })
  ).json();

  await page.goto(`/goals/${goal.id}`);
  await page.getByRole('combobox', { name: 'Conta' }).click();
  await page.getByRole('option', { name: 'Conta E2E' }).click();
  await page.getByLabel('Valor').pressSequentially('30000');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Aporte registrado.', { exact: true })).toBeVisible();
  await expect(page.getByText('· de Conta E2E')).toBeVisible();

  await page.goto(`/accounts/${account.id}`);
  await expect(page.getByText(/Saldo atual\s*R\$\s700,00/)).toBeVisible();
  await expect(page.getByText(/Guardado em metas\s*R\$\s300,00/)).toBeVisible();

  await page.goto(`/goals/${goal.id}`);
  await page.getByRole('button', { name: /^Excluir aporte/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText('Movimentação excluída.', { exact: true })).toBeVisible();
  const restored = await (await page.request.get(`/api/v1/accounts/${account.id}`)).json();
  expect(restored).toMatchObject({ currentBalance: 100_000, goalsTotal: 0 });
});
