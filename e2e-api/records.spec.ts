import { expect, login, navigate, registerNewUser, test } from './fixtures';

test('records an account and an expense, with the balance computed by the API', async ({
  page,
}) => {
  await registerNewUser(page);

  await navigate(page, 'Contas');
  await page.getByRole('link', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome da conta').fill('Conta E2E');
  // A máscara preenche da direita para a esquerda: 1 0 0 0 0 0 → 1.000,00.
  await page.getByLabel('Saldo inicial').pressSequentially('100000');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/accounts/);

  await navigate(page, 'Transações');
  await page.getByRole('link', { name: 'Nova transação' }).click();
  await page.getByLabel('Descrição').fill('Mercado E2E');
  await page.getByLabel('Valor').pressSequentially('25050');
  await page.getByRole('combobox', { name: 'Conta' }).click();
  await page.getByRole('option', { name: /Conta E2E/ }).click();
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Alimentação' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText('Mercado E2E').first()).toBeVisible();

  // 1.000,00 − 250,50, calculado no servidor.
  await navigate(page, 'Contas');
  const account = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: 'Conta E2E', exact: true }) });
  await expect(account).toContainText('749,50');
});

test('deletes the account only with the current password', async ({ page }) => {
  const { email, password } = await registerNewUser(page);

  await navigate(page, 'Segurança');
  await page.getByLabel('Digite seu e-mail para confirmar').fill(email);
  await page.getByLabel('Senha atual (confirmação)').fill('senha-errada1');
  await page.getByRole('button', { name: 'Excluir conta e dados' }).click();
  await expect(page.getByText('Senha incorreta.')).toBeVisible();

  await page.getByLabel('Senha atual (confirmação)').fill(password);
  await page.getByRole('button', { name: 'Excluir conta e dados' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, email, password);
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
});

test('changes the password and signs in with the new one', async ({ page }) => {
  const { email, password } = await registerNewUser(page);

  await navigate(page, 'Segurança');
  await page.getByLabel('Senha atual', { exact: true }).fill(password);
  await page.getByLabel('Senha nova', { exact: true }).fill('novaSenha99');
  await page.getByLabel('Confirmar a senha nova').fill('novaSenha99');
  await page.getByRole('button', { name: 'Trocar a senha' }).click();
  await expect(page.getByText('Senha alterada.')).toBeVisible();

  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: /Sair/ }).click();
  await login(page, email, password);
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  await login(page, email, 'novaSenha99');
  await expect(page).toHaveURL(/\/dashboard$/);
});
