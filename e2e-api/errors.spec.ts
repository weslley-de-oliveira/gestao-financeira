import { expect, navigate, registerNewUser, test } from './fixtures';

test('shows the error code of a failure outside the API and reports it to the API log', async ({
  page,
}) => {
  await registerNewUser(page);

  // A API fora do ar, como o proxy responderia: 503 sem Problem Details.
  await page.route('**/api/v1/accounts', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'Service Unavailable' })
      : route.fallback(),
  );
  const report = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/client-errors') && request.method() === 'POST',
  );

  await navigate(page, 'Contas');
  await page.getByRole('link', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome da conta').fill('Conta E2E');
  await page.getByRole('button', { name: 'Salvar' }).click();

  const failed = await report;
  const body = failed.postDataJSON() as { kind: string; message: string; requestId: string };
  expect(body).toMatchObject({
    kind: 'network',
    message: 'Resposta 503 sem Problem Details: /api/v1/accounts',
  });
  // A API aceitou o relato (gravado no log dela).
  expect((await failed.response())?.status()).toBe(204);

  // O código na tela é o começo do id da requisição que falhou.
  await expect(
    page.getByText(
      `Não foi possível salvar a conta. Tente novamente em instantes. Código do erro: ${body.requestId.slice(0, 8)}.`,
    ),
  ).toBeVisible();
});
