import { expect, test, waitForHydration } from './fixtures';

// Fixture data: Horror has 3 films (Get Out, The Shining, Hereditary); Action has 4.

test.describe('arc carousel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
  });

  test('the arrows move through the films and wrap around both ends', async ({ page }) => {
    const horror = page.getByRole('region', { name: 'Horror' });
    const caption = horror.locator('.carousel__label');
    await expect(caption).toContainText('01 / 03');
    await expect(caption).toContainText('Get Out');

    await horror.getByRole('button', { name: 'Next film' }).click();
    await expect(caption).toContainText('02 / 03');
    await expect(caption).toContainText('The Shining');

    await horror.getByRole('button', { name: 'Previous film' }).click();
    await horror.getByRole('button', { name: 'Previous film' }).click();
    await expect(caption).toContainText('03 / 03');
    await expect(caption).toContainText('Hereditary');
    await expect(horror.getByText('Film 3 of 3: Hereditary')).toBeAttached();
  });

  test('the glow flows to the next category on scroll, and on to the next film on slide', async ({
    page,
  }) => {
    const glow = page.getByTestId('category-glow');
    const glowColour = () =>
      glow.evaluate((element) => getComputedStyle(element).getPropertyValue('--gradient-1'));
    await expect(glow).toHaveAttribute('data-category', 'action');
    const actionColour = await glowColour();

    await page
      .getByRole('region', { name: 'Action' })
      .getByRole('button', { name: 'Next film' })
      .click();
    await expect(glow).toHaveAttribute('data-gradient-step', '1');
    await expect.poll(glowColour).not.toBe(actionColour);

    await page.getByTestId('category-panel-horror').scrollIntoViewIfNeeded();
    await expect(glow).toHaveAttribute('data-category', 'horror');
    await expect(page.getByTestId('category-panel-horror')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('category-panel-action')).toHaveAttribute(
      'data-state',
      'inactive',
    );
  });

  test('the keyboard moves the carousel and the focus follows the active film', async ({
    page,
  }) => {
    const horror = page.getByRole('region', { name: 'Horror' });
    await horror.getByRole('link', { name: /Get Out/ }).focus();

    await page.keyboard.press('ArrowRight');
    await expect(horror.getByRole('link', { name: /The Shining/ })).toBeFocused();

    await page.keyboard.press('End');
    await expect(horror.getByRole('link', { name: /Hereditary/ })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(horror.getByRole('link', { name: /Get Out/ })).toBeFocused();
  });

  test('a card beside the active one opens its film too', async ({ page }) => {
    await page
      .getByRole('region', { name: 'Action' })
      .getByRole('link', { name: /22 Jump Street/ })
      .click();

    await expect(page).toHaveURL('/film/187017?category=action');
    await expect(page.getByRole('heading', { level: 1, name: '22 Jump Street' })).toBeVisible();
  });

  test('shows a skeleton while a category loads after navigation', async ({ page }) => {
    await page.getByRole('link', { name: 'Wish list, 0 films' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your wish list' })).toBeVisible();

    let releaseHorror: () => void = () => undefined;
    const horrorReleased = new Promise<void>((resolve) => {
      releaseHorror = resolve;
    });
    await page.route('**/api/genres/27/films', async (route) => {
      await horrorReleased;
      await route.continue();
    });

    await page.getByRole('link', { name: 'Film Browser' }).click();

    await expect(page.getByRole('region', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading horror films' })).toBeVisible();

    releaseHorror();

    await expect(page.getByRole('region', { name: 'Horror' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading horror films' })).toBeHidden();
  });
});

test.describe('arc carousel without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the arrows are links that the server renders with the next film in front', async ({
    page,
  }) => {
    await page.goto('/');
    const horror = page.getByRole('region', { name: 'Horror' });

    await horror.getByRole('link', { name: 'Next film' }).click();

    await expect(page).toHaveURL('/?horror=1');
    await expect(
      page.getByRole('region', { name: 'Horror' }).locator('.carousel__label'),
    ).toContainText('The Shining');
  });
});
