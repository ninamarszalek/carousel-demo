import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { WishlistItem } from '@/features/wishlist/wishlist-cookie';
import { FilmServiceError, type FilmsApi } from '@/types/films-api';

import { createFakeFilmsApi } from '../../tests/mocks/fake-films-api';
import { createMemoryWishlistStorage } from '../../tests/mocks/memory-wishlist-storage';
import { GENRE_IDS } from '../../tests/mocks/tmdb/fixtures';
import { createRoutes } from './routes';

interface RenderOptions {
  films?: FilmsApi;
  wishlist?: WishlistItem[];
  /** `true` like in the browser (skeletons while loading); `false` like on the server. */
  deferData?: boolean;
}

/** Renders the real route tree in memory, like the browser does after hydration. */
function renderApp(
  path: string,
  { films = createFakeFilmsApi(), wishlist = [], deferData = true }: RenderOptions = {},
) {
  const storage = createMemoryWishlistStorage(wishlist);
  const router = createMemoryRouter(createRoutes({ films, wishlist: storage, deferData }), {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return { router, storage, user: userEvent.setup() };
}

describe('homepage', () => {
  it('shows a row of films for each category, linking to the film in that category', async () => {
    renderApp('/');

    const comedy = await screen.findByRole('region', { name: 'Comedy' });
    expect(screen.getByRole('heading', { level: 1, name: 'Browse films' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Horror' })).toBeInTheDocument();
    expect(within(comedy).getByRole('link', { name: /22 Jump Street/ })).toHaveAttribute(
      'href',
      '/film/187017?category=comedy',
    );
    expect(document.title).toBe('Film Browser');
  });

  it('gives each category its own panel, and moves the glow on with the carousel', async () => {
    const { user } = renderApp('/');

    const action = await screen.findByRole('region', { name: 'Action' });
    expect(screen.getByTestId('category-panel-comedy')).toHaveAttribute('data-category', 'comedy');
    // Without a measured scroll position (jsdom), the glow shows the first category.
    const glow = screen.getByTestId('category-glow');
    expect(glow).toHaveAttribute('data-category', 'action');
    expect(glow).toHaveAttribute('data-gradient-step', '0');

    await user.click(within(action).getByRole('button', { name: 'Next film' }));
    expect(glow).toHaveAttribute('data-gradient-step', '1');

    // 4 action films, 4 glow steps: going back from the first film wraps to film 4, step 3.
    await user.click(within(action).getByRole('button', { name: 'Previous film' }));
    await user.click(within(action).getByRole('button', { name: 'Previous film' }));
    expect(glow).toHaveAttribute('data-gradient-step', '3');
  });

  it('shows an error with a retry link in a failed row, and recovers on retry', async () => {
    const fake = createFakeFilmsApi();
    const getFilmsByGenre = vi
      .fn<FilmsApi['getFilmsByGenre']>()
      .mockImplementation(fake.getFilmsByGenre)
      .mockRejectedValueOnce(new FilmServiceError('TMDB down', 503));
    const { user } = renderApp('/', { films: { ...fake, getFilmsByGenre } });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load action films.");
    expect(screen.getByRole('region', { name: 'Comedy' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Try again' }));

    expect(await screen.findByRole('region', { name: 'Action' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a skeleton for each category while it loads, then its carousel', async () => {
    const fake = createFakeFilmsApi();
    let releaseComedy: () => void = () => undefined;
    const comedyLoaded = new Promise<void>((resolve) => {
      releaseComedy = resolve;
    });
    const getFilmsByGenre: FilmsApi['getFilmsByGenre'] = async (genreId, signal) => {
      if (genreId === GENRE_IDS.comedy) {
        await comedyLoaded;
      }
      return fake.getFilmsByGenre(genreId, signal);
    };
    renderApp('/', { films: { ...fake, getFilmsByGenre } });

    expect(await screen.findByRole('region', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading comedy films' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Comedy' })).not.toBeInTheDocument();

    releaseComedy();

    expect(await screen.findByRole('region', { name: 'Comedy' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading comedy films' })).not.toBeInTheDocument();
  });

  it('shows the error page when every category fails on the server', async () => {
    renderApp('/', {
      deferData: false,
      films: createFakeFilmsApi({
        getFilmsByGenre: () => Promise.reject(new FilmServiceError('TMDB down', null)),
      }),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Couldn't load films. Please try again in a moment."),
    ).toBeInTheDocument();
    expect(document.title).toBe('Something went wrong · Film Browser');
  });
});

describe('film page', () => {
  it('opens from a carousel in its category', async () => {
    const { user } = renderApp('/');

    const horror = await screen.findByRole('region', { name: 'Horror' });
    await user.click(within(horror).getByRole('link', { name: /Get Out/ }));

    await screen.findByRole('heading', { level: 1, name: 'Get Out' });
    expect(screen.getByRole('article')).toHaveAttribute('data-category', 'horror');
    expect(document.title).toBe('Get Out (2017) · Film Browser');
  });

  it('shows the description, image, button and additional info', async () => {
    renderApp('/film/603?category=action');

    await screen.findByRole('heading', { level: 1, name: 'The Matrix' });
    expect(screen.getByRole('img', { name: 'Still from The Matrix' })).toBeInTheDocument();
    expect(screen.getByText(/computer hacker/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Key facts' })).toHaveTextContent('1999');
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('March 31, 1999')).toBeInTheDocument();
    expect(within(details).getByText('Lana Wachowski, Lilly Wachowski')).toBeInTheDocument();
    expect(within(details).getByText('Directors')).toBeInTheDocument();
    expect(within(details).getByText('Keanu Reeves')).toBeInTheDocument();
  });

  it('falls back to the poster when there is no backdrop', async () => {
    renderApp('/film/187017');

    expect(
      await screen.findByRole('img', { name: 'Poster of 22 Jump Street' }),
    ).toBeInTheDocument();
  });

  it('adds the film to the wish list and removes it again', async () => {
    const { storage, user } = renderApp('/film/603?category=action');

    const button = await screen.findByRole('button', { name: 'Add to wish list' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('link', { name: 'Wish list, 0 films' })).toBeInTheDocument();

    await user.click(button);

    expect(await screen.findByRole('link', { name: 'Wish list, 1 film' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from wish list' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(storage.items).toStrictEqual([{ filmId: 603, category: 'action' }]);

    await user.click(screen.getByRole('button', { name: 'Remove from wish list' }));

    expect(await screen.findByRole('link', { name: 'Wish list, 0 films' })).toBeInTheDocument();
    expect(storage.items).toStrictEqual([]);
  });

  it('does not reload the film after a wish list change', async () => {
    const fake = createFakeFilmsApi();
    const getFilm = vi.fn(fake.getFilm);
    const { user } = renderApp('/film/603', { films: { ...fake, getFilm } });

    await user.click(await screen.findByRole('button', { name: 'Add to wish list' }));
    await screen.findByRole('link', { name: 'Wish list, 1 film' });

    expect(getFilm).toHaveBeenCalledTimes(1);
  });

  it('shows the error page when the film service is down', async () => {
    renderApp('/film/603', {
      films: createFakeFilmsApi({
        getFilm: () => Promise.reject(new FilmServiceError('TMDB down', null)),
      }),
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to all films' })).toBeInTheDocument();
  });

  it('shows the not found page, inside the layout, for an unknown film', async () => {
    renderApp('/film/999999');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(document.title).toBe('Page not found · Film Browser');
  });
});

describe('wish list page', () => {
  it('lists the films, linking to them in the category they were added from', async () => {
    renderApp('/wishlist', {
      wishlist: [
        { filmId: 419430, category: 'horror' },
        { filmId: 603, category: null },
      ],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your wish list' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 films')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Get Out/ })).toHaveAttribute(
      'href',
      '/film/419430?category=horror',
    );
    expect(screen.getByRole('link', { name: /The Matrix/ })).toHaveAttribute('href', '/film/603');
    expect(document.title).toBe('Wish list · Film Browser');
  });

  it('removes a film', async () => {
    const { storage, user } = renderApp('/wishlist', {
      wishlist: [{ filmId: 603, category: 'action' }],
    });

    await user.click(
      await screen.findByRole('button', { name: 'Remove The Matrix from wish list' }),
    );

    expect(await screen.findByText('No films yet.')).toBeInTheDocument();
    expect(storage.items).toStrictEqual([]);
  });

  it('shows an empty state with a way back to the films', async () => {
    renderApp('/wishlist');

    expect(await screen.findByText('No films yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse films' })).toHaveAttribute('href', '/');
  });

  it('is reachable from the header', async () => {
    const { user } = renderApp('/', { wishlist: [{ filmId: 603, category: 'action' }] });

    await user.click(await screen.findByRole('link', { name: 'Wish list, 1 film' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Wish list, 1 film' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Your wish list' })).toBeInTheDocument();
  });
});

describe('layout', () => {
  it('has a skip link to the main content', async () => {
    renderApp('/');

    await screen.findByRole('region', { name: 'Action' });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('shows the not found page for unknown paths', async () => {
    renderApp('/no/such/page');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to all films' })).toHaveAttribute('href', '/');
  });
});

describe('genre ids', () => {
  it('are the ones the categories ask TMDB for', async () => {
    const fake = createFakeFilmsApi();
    const getFilmsByGenre = vi.fn(fake.getFilmsByGenre);
    renderApp('/', { films: { ...fake, getFilmsByGenre } });

    await screen.findByRole('region', { name: 'Action' });

    expect(getFilmsByGenre.mock.calls.map(([genreId]) => genreId)).toStrictEqual([
      GENRE_IDS.action,
      GENRE_IDS.comedy,
      GENRE_IDS.horror,
    ]);
  });
});
