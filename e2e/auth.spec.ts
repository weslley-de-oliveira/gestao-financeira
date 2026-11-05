import { expect, test } from './fixtures';

test('rejects invalid credentials with a generic message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('demo@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada1');

  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  await expect(page).toHaveURL(/\/login$/);
});

test('creates an account, signs out and signs in again', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Pessoa Teste');
  await page.getByLabel('E-mail').fill('teste@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha1234');
  await page.getByLabel('Confirmar senha').fill('senha1234');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Pessoa!');

  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: /Sair/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill('teste@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha1234');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('rejects a duplicate e-mail on registration', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Outra Pessoa');
  await page.getByLabel('E-mail').fill('demo@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha1234');
  await page.getByLabel('Confirmar senha').fill('senha1234');

  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByText(/já (está )?cadastrad/i)).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
