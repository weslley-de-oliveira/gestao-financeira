import { expect, loginAsDemo, navigate, test } from './fixtures';

test('keeps changes after reloading and restores the initial data', async ({ page }) => {
  await loginAsDemo(page);
  const greeting = await page.getByRole('heading', { level: 1 }).textContent();

  await navigate(page, 'Configurações');
  await page.getByLabel('Nome').fill('Nome Alterado');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByText('Perfil atualizado.')).toBeVisible();

  // Os dados ficam no localStorage: sobrevivem ao recarregamento.
  await page.reload();
  await expect(page.getByLabel('Nome')).toHaveValue('Nome Alterado');

  await page.getByRole('button', { name: 'Restaurar dados iniciais' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Dados da demonstração restaurados.')).toBeVisible();

  await loginAsDemo(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(greeting ?? '');
});
