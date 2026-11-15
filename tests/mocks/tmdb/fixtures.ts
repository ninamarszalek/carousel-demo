import type {
  TmdbMovieDetails,
  TmdbMovieListItem,
  TmdbPagedResponse,
} from '../../../server/tmdb/dto';

/**
 * Hand-written TMDB data in the exact shape of the TMDB API, trimmed to the fields we use.
 * Shared by the MSW handlers (unit/server tests) and the e2e mock server, so every test level
 * sees the same films.
 */

export const GENRE_IDS = { action: 28, comedy: 35, horror: 27 } as const;

/** A film that is both Action and Comedy: the category must come from the carousel it was opened from. */
export const MULTI_GENRE_FILM_ID = 187017;
/** Id that TMDB does not know. */
export const UNKNOWN_FILM_ID = 999999;

const listItem = (
  id: number,
  title: string,
  releaseDate: string,
  genreIds: number[],
  voteAverage = 7.5,
): TmdbMovieListItem => ({
  id,
  title,
  poster_path: `/poster-${String(id)}.jpg`,
  release_date: releaseDate,
  vote_average: voteAverage,
  vote_count: 10_000,
  genre_ids: genreIds,
});

const page = (results: TmdbMovieListItem[]): TmdbPagedResponse<TmdbMovieListItem> => ({
  page: 1,
  results,
  total_pages: 1,
  total_results: results.length,
});

export const discoverByGenre: Record<number, TmdbPagedResponse<TmdbMovieListItem>> = {
  [GENRE_IDS.action]: page([
    listItem(603, 'The Matrix', '1999-03-31', [28, 878], 8.2),
    listItem(76341, 'Mad Max: Fury Road', '2015-05-13', [28, 12, 878], 7.6),
    listItem(MULTI_GENRE_FILM_ID, '22 Jump Street', '2014-06-05', [28, 35, 80], 6.8),
    listItem(245891, 'John Wick', '2014-10-22', [28, 53], 7.4),
  ]),
  [GENRE_IDS.comedy]: page([
    listItem(MULTI_GENRE_FILM_ID, '22 Jump Street', '2014-06-05', [28, 35, 80], 6.8),
    listItem(120467, 'The Grand Budapest Hotel', '2014-02-26', [35, 18], 8.0),
    listItem(8363, 'Superbad', '2007-08-17', [35], 7.2),
  ]),
  [GENRE_IDS.horror]: page([
    listItem(419430, 'Get Out', '2017-02-24', [9648, 53, 27], 7.6),
    listItem(694, 'The Shining', '1980-05-23', [27, 53], 8.2),
    listItem(493922, 'Hereditary', '2018-06-07', [27, 9648, 53], 7.3),
  ]),
};

export const movieDetails: Record<number, TmdbMovieDetails> = {
  603: {
    id: 603,
    title: 'The Matrix',
    tagline: 'Welcome to the Real World.',
    overview:
      'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
    poster_path: '/poster-603.jpg',
    backdrop_path: '/backdrop-603.jpg',
    release_date: '1999-03-31',
    runtime: 136,
    vote_average: 8.217,
    vote_count: 26_000,
    original_language: 'en',
    genres: [
      { id: 28, name: 'Action' },
      { id: 878, name: 'Science Fiction' },
    ],
    credits: {
      cast: [
        {
          id: 6384,
          name: 'Keanu Reeves',
          character: 'Thomas A. Anderson / Neo',
          order: 0,
          profile_path: null,
        },
        {
          id: 2975,
          name: 'Laurence Fishburne',
          character: 'Morpheus',
          order: 1,
          profile_path: null,
        },
        { id: 530, name: 'Carrie-Anne Moss', character: 'Trinity', order: 2, profile_path: null },
      ],
      crew: [
        { id: 9340, name: 'Lana Wachowski', job: 'Director' },
        { id: 9339, name: 'Lilly Wachowski', job: 'Director' },
        { id: 9341, name: 'Joel Silver', job: 'Producer' },
      ],
    },
  },
  [MULTI_GENRE_FILM_ID]: {
    id: MULTI_GENRE_FILM_ID,
    title: '22 Jump Street',
    tagline: 'They’re not 21 anymore.',
    overview:
      'After making their way through high school (twice), big changes are in store for officers Schmidt and Jenko when they go deep undercover at a local college.',
    poster_path: '/poster-187017.jpg',
    backdrop_path: null,
    release_date: '2014-06-05',
    runtime: 112,
    vote_average: 6.8,
    vote_count: 9_000,
    original_language: 'en',
    genres: [
      { id: 28, name: 'Action' },
      { id: 35, name: 'Comedy' },
      { id: 80, name: 'Crime' },
    ],
    credits: {
      cast: [
        { id: 38673, name: 'Channing Tatum', character: 'Jenko', order: 1, profile_path: null },
        { id: 21007, name: 'Jonah Hill', character: 'Schmidt', order: 0, profile_path: null },
      ],
      crew: [
        { id: 1, name: 'Phil Lord', job: 'Director' },
        { id: 2, name: 'Christopher Miller', job: 'Director' },
      ],
    },
  },
  419430: {
    id: 419430,
    title: 'Get Out',
    tagline: 'Just because you’re invited, doesn’t mean you’re welcome.',
    overview:
      'Chris and his girlfriend Rose go upstate to visit her parents for the weekend. At first, Chris reads the family’s overly accommodating behavior as nervous attempts to deal with their daughter’s interracial relationship.',
    poster_path: '/poster-419430.jpg',
    backdrop_path: '/backdrop-419430.jpg',
    release_date: '2017-02-24',
    runtime: 104,
    vote_average: 7.6,
    vote_count: 17_000,
    original_language: 'en',
    genres: [
      { id: 9648, name: 'Mystery' },
      { id: 53, name: 'Thriller' },
      { id: 27, name: 'Horror' },
    ],
    credits: {
      cast: [
        {
          id: 206919,
          name: 'Daniel Kaluuya',
          character: 'Chris Washington',
          order: 0,
          profile_path: null,
        },
      ],
      crew: [{ id: 291263, name: 'Jordan Peele', job: 'Director' }],
    },
  },
};
