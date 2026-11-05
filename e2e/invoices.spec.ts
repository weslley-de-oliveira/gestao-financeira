import { expect, loginAsDemo, navigate, test } from './fixtures';

test('pays a closed invoice and undoes the payment', async ({ page }) => {
  await loginAsDemo(page);
  await navigate(page, 'Faturas');

  // O seed deixa a fatura fechada mais recente do cartão principal sem pagamento.
  await page.getByRole('combobox', { name: 'Cartão' }).click();
  await page.getByRole('option', { name: /Cartão principal/ }).click();
  await page.getByRole('combobox', { name: 'Mês de referência' }).click();
  await page
    .getByRole('option', { name: /Fechada/ })
    .first()
    .click();

  await page.getByRole('button', { name: /^Pagar R\$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pagar', exact: true }).click();

  await expect(page.getByText(/Paga em/)).toBeVisible();

  await page.getByRole('button', { name: 'Desfazer pagamento' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desfazer', exact: true }).click();

  await expect(page.getByRole('button', { name: /^Pagar R\$/ })).toBeVisible();
});
