import { describe, expect, it } from 'vitest';

import { movieDetails } from '../../tests/mocks/tmdb/fixtures';
import { CAST_LIMIT, detailsToSummary, toFilmDetails, toFilmSummary } from './mappers';

describe('toFilmSummary', () => {
  it('maps a TMDB list item to a film summary', () => {
    expect(
      toFilmSummary({
        id: 603,
        title: 'The Matrix',
        poster_path: '/matrix.jpg',
        release_date: '1999-03-31',
        vote_average: 8.217,
        vote_count: 26_000,
        genre_ids: [28, 878],
      }),
    ).toStrictEqual({
      id: 603,
      title: 'The Matrix',
      posterPath: '/matrix.jpg',
      releaseYear: 1999,
      rating: 8.2,
      genreIds: [28, 878],
    });
  });

  it('turns missing and empty fields into null, never undefined or ""', () => {
    expect(
      toFilmSummary({ id: 1, title: '  ', poster_path: '', release_date: '', vote_average: 0 }),
    ).toStrictEqual({
      id: 1,
      title: 'Untitled',
      posterPath: null,
      releaseYear: null,
      rating: null,
      genreIds: [],
    });
  });

  it('has no rating when nobody has voted yet', () => {
    expect(toFilmSummary({ id: 1, vote_average: 0, vote_count: 0 }).rating).toBeNull();
  });
});

describe('toFilmDetails', () => {
  it('maps a TMDB movie with credits to film details', () => {
    const film = toFilmDetails(movieDetails[603] ?? { id: 0 });

    expect(film).toMatchObject({
      id: 603,
      title: 'The Matrix',
      tagline: 'Welcome to the Real World.',
      releaseDate: '1999-03-31',
      releaseYear: 1999,
      runtimeMinutes: 136,
      rating: 8.2,
      voteCount: 26_000,
      originalLanguage: 'en',
      genres: [
        { id: 28, name: 'Action' },
        { id: 878, name: 'Science Fiction' },
      ],
      directors: ['Lana Wachowski', 'Lilly Wachowski'],
    });
    expect(film.cast.map((member) => member.name)).toStrictEqual([
      'Keanu Reeves',
      'Laurence Fishburne',
      'Carrie-Anne Moss',
    ]);
  });

  it('sorts the cast by billing order and keeps only the top-billed', () => {
    const cast = Array.from({ length: CAST_LIMIT + 2 }, (_, index) => ({
      id: index,
      name: `Actor ${String(index)}`,
      order: CAST_LIMIT + 1 - index,
    }));

    const film = toFilmDetails({ id: 1, credits: { cast } });

    expect(film.cast).toHaveLength(CAST_LIMIT);
    expect(film.cast[0]?.name).toBe(`Actor ${String(CAST_LIMIT + 1)}`);
  });

  it('copes with a movie that has almost no data', () => {
    expect(toFilmDetails({ id: 7, runtime: 0, credits: null })).toStrictEqual({
      id: 7,
      title: 'Untitled',
      posterPath: null,
      backdropPath: null,
      releaseYear: null,
      releaseDate: null,
      rating: null,
      voteCount: 0,
      overview: null,
      tagline: null,
      runtimeMinutes: null,
      originalLanguage: null,
      genres: [],
      directors: [],
      cast: [],
    });
  });

  it('drops nameless genres and cast members, and duplicate directors', () => {
    const film = toFilmDetails({
      id: 1,
      genres: [
        { id: 1, name: '' },
        { id: 2, name: 'Drama' },
      ],
      credits: {
        cast: [{ id: 1, name: null }],
        crew: [
          { id: 1, name: 'Ann', job: 'Director' },
          { id: 1, name: 'Ann', job: 'Director' },
        ],
      },
    });

    expect(film.genres).toStrictEqual([{ id: 2, name: 'Drama' }]);
    expect(film.cast).toStrictEqual([]);
    expect(film.directors).toStrictEqual(['Ann']);
  });
});

describe('detailsToSummary', () => {
  it('derives the summary, with genre ids, from film details', () => {
    const film = toFilmDetails(movieDetails[603] ?? { id: 0 });

    expect(detailsToSummary(film)).toStrictEqual({
      id: 603,
      title: 'The Matrix',
      posterPath: '/poster-603.jpg',
      releaseYear: 1999,
      rating: 8.2,
      genreIds: [28, 878],
    });
  });
});
