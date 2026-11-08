import { Page } from '@playwright/test';
import { expect, loginAsDemo, test } from './fixtures';

/** Saldo atual exibido no detalhe da conta, em centavos. */
async function currentBalance(page: Page): Promise<number> {
  const text = await page.locator('.account-detail__amount').first().innerText();
  const cents = Number(text.replace(/\D/g, ''));
  return /[-−]/.test(text) ? -cents : cents;
}

test('saves money from an account in a goal and undoes it', async ({ page }) => {
  await loginAsDemo(page);

  await page.goto('/accounts');
  await page.getByRole('link', { name: /Conta corrente/ }).click();
  await page.waitForURL(/\/accounts\/[^/]+$/);
  await expect(page.locator('.account-detail__amount').first()).toBeVisible();
  const accountUrl = page.url();
  const before = await currentBalance(page);
  await expect(page.getByText('Guardado em metas')).toHaveCount(0);

  await page.goto('/goals');
  await page.getByRole('link', { name: /Notebook novo/ }).click();
  await page.getByRole('combobox', { name: 'Conta' }).click();
  await page.getByRole('option', { name: 'Conta corrente' }).click();
  await expect(page.getByText('O valor sai da conta escolhida')).toBeVisible();
  await page.getByLabel('Valor').pressSequentially('10000');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Aporte registrado.', { exact: true })).toBeVisible();
  await expect(page.getByText('· de Conta corrente')).toBeVisible();
  const goalUrl = page.url();

  await page.goto(accountUrl);
  await expect(page.getByText(/Guardado em metas\s*R\$\s100,00/)).toBeVisible();
  expect(await currentBalance(page)).toBe(before - 10_000);

  // Excluir o aporte devolve o valor à conta.
  await page.goto(goalUrl);
  await page
    .getByRole('button', { name: /^Excluir aporte/ })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText('Movimentação excluída.', { exact: true })).toBeVisible();
  await page.goto(accountUrl);
  await expect(page.locator('.account-detail__amount').first()).toBeVisible();
  expect(await currentBalance(page)).toBe(before);
  await expect(page.getByText('Guardado em metas')).toHaveCount(0);
});
