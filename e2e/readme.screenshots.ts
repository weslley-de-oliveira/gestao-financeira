import { Page } from '@playwright/test';

import { expect, loginAsDemo, navigate, test, waitForContent } from './fixtures';

const IMAGES = 'docs/images';

/** Espera dados, fontes e animações (Material e gráficos) assentarem antes da captura. */
async function capture(page: Page, name: string): Promise<void> {
  await waitForContent(page);
  await page.evaluate(async () => {
    await document.fonts.load('24px "Material Symbols Outlined"');
    await document.fonts.ready;
  });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: `${IMAGES}/${name}.png`, animations: 'disabled' });
}

test('dashboard nos temas claro e escuro', async ({ page }) => {
  await loginAsDemo(page);
  await capture(page, 'dashboard');

  await page.getByRole('button', { name: 'Usar tema escuro' }).click();
  await capture(page, 'dashboard-escuro');
});

test('lista de transações', async ({ page }) => {
  await loginAsDemo(page);
  await navigate(page, 'Transações');
  await expect(page.getByRole('heading', { level: 1, name: 'Transações' })).toBeVisible();
  await capture(page, 'transacoes');
});

test('fatura com pagamento parcial', async ({ page }) => {
  await loginAsDemo(page);
  await navigate(page, 'Faturas');
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Mês de referência' }).click();
  await page
    .getByRole('option', { name: /Fechada/ })
    .first()
    .click();

  // Na demo, os dados ficam só neste navegador: o pagamento não sai daqui.
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('100000');
  await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByText(/^Falta pagar R\$/)).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByText('Pagamento parcial registrado.')).toHaveCount(0);
  await capture(page, 'fatura-pagamento-parcial');
});

test('dashboard no celular', async ({ page }) => {
  await loginAsDemo(page);
  await capture(page, 'celular');
});
