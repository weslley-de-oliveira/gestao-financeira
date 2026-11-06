import { DEMO, expect, login, navigate, test } from './fixtures';

test('signs in with the demo account, keeps the session on reload and signs out', async ({
  page,
}) => {
  await login(page, DEMO.email, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Olá');

  // A sessão está no cookie HttpOnly: ao recarregar, o app pergunta à API quem está logado.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  await navigate(page, 'Contas');
  await expect(page.getByRole('main').getByRole('listitem').first()).toContainText('R$');

  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: /Sair/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/accounts');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Faccounts$/);
});

test('rejects invalid credentials with a generic message', async ({ page }) => {
  await login(page, DEMO.email, 'senha-errada1');

  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  await expect(page).toHaveURL(/\/login$/);
});

test('goes back to the login, keeping the page, when the session ends on the server', async ({
  page,
  context,
}) => {
  await login(page, DEMO.email, DEMO.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await navigate(page, 'Contas');
  await expect(page).toHaveURL(/\/accounts$/);

  // Sessão encerrada fora desta aba (ex.: expirou): a próxima chamada à API recebe 401.
  await context.clearCookies();
  await navigate(page, 'Transações');

  await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftransactions$/);
});
