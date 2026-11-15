import { expect, test, waitForHydration } from './fixtures';

test.describe('browsing films', () => {
  test('the homepage shows one carousel per category', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Film Browser');
    await expect(page.getByRole('heading', { level: 1, name: 'Browse films' })).toBeVisible();
    for (const category of ['Action', 'Comedy', 'Horror']) {
      await expect(page.getByRole('heading', { level: 2, name: category })).toBeVisible();
    }
    await expect(page.getByRole('list', { name: 'Horror' }).getByRole('listitem')).toHaveCount(3);
  });

  test('a film opens in the category of the carousel it was clicked in', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    // 22 Jump Street is both Action and Comedy.
    await page
      .getByRole('list', { name: 'Comedy' })
      .getByRole('link', { name: /22 Jump Street/ })
      .click();

    await expect(page).toHaveURL('/film/187017?category=comedy');
    await expect(page.getByRole('heading', { level: 1, name: '22 Jump Street' })).toBeVisible();
    await expect(page.locator('article[data-category]')).toHaveAttribute('data-category', 'comedy');
    await expect(page).toHaveTitle('22 Jump Street (2014) · Film Browser');
  });

  test('the film page has the description, image, button and additional info', async ({ page }) => {
    await page.goto('/film/603?category=action');

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'The Matrix' })).toBeVisible();
    await expect(main.getByRole('img', { name: 'Still from The Matrix' })).toBeVisible();
    await expect(main).toContainText('computer hacker');
    await expect(main.getByRole('button', { name: 'Add to wish list' })).toBeVisible();
    await expect(main.getByRole('region', { name: 'Details' })).toContainText('2h 16m');
    await expect(main.getByRole('region', { name: 'Details' })).toContainText('Keanu Reeves');
  });

  test('an unknown film shows the not found page with status 404', async ({
    page,
    consoleErrors,
  }) => {
    const response = await page.goto('/film/999999');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found · Film Browser');

    // Chrome logs the 404 status of the document itself; any other error still fails the test.
    const expected =
      'Failed to load resource: the server responded with a status of 404 (Not Found)';
    const others = consoleErrors.filter((error) => error !== expected);
    consoleErrors.splice(0, consoleErrors.length, ...others);
  });
});

test.describe('wish list', () => {
  test('adds a film, lists it, and removes it again', async ({ page }) => {
    await page.goto('/film/603?category=action');
    await waitForHydration(page);
    const wishlistLink = page.getByRole('link', { name: /^Wish list/ });
    await expect(wishlistLink).toHaveAccessibleName('Wish list, 0 films');

    await page.getByRole('button', { name: 'Add to wish list' }).click();

    await expect(page.getByRole('button', { name: 'Remove from wish list' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(wishlistLink).toHaveAccessibleName('Wish list, 1 film');

    await wishlistLink.click();
    await expect(page).toHaveURL('/wishlist');
    await expect(page.getByRole('heading', { level: 1, name: 'Your wish list' })).toBeVisible();
    await expect(page.getByRole('link', { name: /The Matrix/ })).toHaveAttribute(
      'href',
      '/film/603?category=action',
    );

    await page.getByRole('button', { name: 'Remove The Matrix from wish list' }).click();

    await expect(page.getByText('No films yet.')).toBeVisible();
    await expect(wishlistLink).toHaveAccessibleName('Wish list, 0 films');
  });

  test('keeps the list after a reload (it lives in a cookie)', async ({ page }) => {
    await page.goto('/film/419430?category=horror');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'Add to wish list' }).click();
    await expect(page.getByRole('link', { name: 'Wish list, 1 film' })).toBeVisible();

    await page.goto('/wishlist');

    await expect(page.getByRole('link', { name: /Get Out/ })).toBeVisible();
  });
});
