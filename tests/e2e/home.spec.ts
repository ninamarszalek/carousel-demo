import { expect, test } from '@playwright/test';

test.describe('homepage', () => {
  test('renders and hydrates without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Film Browser' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('homepage without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('is fully rendered on the server', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Film Browser' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Browse films by category');
  });
});
