import { expect, loginAsDemo, navigate, test } from './fixtures';

test('pays a closed invoice in two parts and undoes the payments', async ({ page }) => {
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

  // Primeiro, R$ 1,00: a fatura continua com saldo.
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor').fill('');
  await dialog.getByLabel('Valor').pressSequentially('100');
  await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByText(/^Falta pagar R\$/)).toBeVisible();
  await expect(page.getByText(/\(parcial\)$/)).toBeVisible();

  // Depois, o restante (o valor padrão): a fatura fica quitada.
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByText('Fatura quitada.')).toBeVisible();

  // Desfazer apaga um pagamento por vez, do mais recente para o mais antigo.
  await page.getByRole('button', { name: 'Desfazer último pagamento' }).click();
  await dialog.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByText(/^Falta pagar R\$/)).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer último pagamento' }).click();
  await dialog.getByRole('button', { name: 'Desfazer', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Pagar fatura' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desfazer último pagamento' })).toBeHidden();
});
