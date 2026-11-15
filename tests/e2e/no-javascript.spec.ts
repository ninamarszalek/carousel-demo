import { expect, test } from './fixtures';

// These tests prove that the pages are rendered on the server, and that the wish list form works
// as a plain HTML form (progressive enhancement).
test.use({ javaScriptEnabled: false });

test.describe('without JavaScript', () => {
  test('the homepage is fully rendered', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Browse films' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Action' })).toContainText('The Matrix');
    await expect(page.getByRole('list', { name: 'Horror' })).toContainText('The Shining');
  });

  test('links navigate to a fully rendered film page', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('list', { name: 'Horror' })
      .getByRole('link', { name: /Get Out/ })
      .click();

    await expect(page).toHaveURL('/film/419430?category=horror');
    await expect(page.getByRole('heading', { level: 1, name: 'Get Out' })).toBeVisible();
    await expect(page.locator('article[data-category]')).toHaveAttribute('data-category', 'horror');
  });

  test('the wish list button works as a plain form post', async ({ page }) => {
    await page.goto('/film/603?category=action');

    await page.getByRole('button', { name: 'Add to wish list' }).click();

    // Post/Redirect/Get: back on the same page, now with the film on the list.
    await expect(page).toHaveURL('/film/603?category=action');
    await expect(page.getByRole('button', { name: 'Remove from wish list' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wish list, 1 film' })).toBeVisible();

    await page.getByRole('link', { name: 'Wish list, 1 film' }).click();
    await expect(page.getByRole('link', { name: /The Matrix/ })).toBeVisible();
  });
});
