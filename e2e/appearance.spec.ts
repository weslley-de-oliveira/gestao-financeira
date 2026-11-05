import { expect, loginAsDemo, test } from './fixtures';

test('changes the accent color from the top bar and keeps it after reloading', async ({ page }) => {
  await loginAsDemo(page);
  const html = page.locator('html');
  await expect(html).toHaveClass(/accent-navy/);

  await page.getByRole('button', { name: 'Cor de destaque' }).click();
  await page.getByRole('menuitemradio', { name: 'Verde' }).click();

  await expect(html).toHaveClass(/accent-green/);
  await page.reload();
  await expect(html).toHaveClass(/accent-green/);

  await page.getByRole('button', { name: 'Cor de destaque' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Verde' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
