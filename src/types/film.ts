/**
 * Domain models shared by the server (TMDB mapping, BFF responses) and the client (pages).
 * Fields that TMDB may leave out are `null`, never `undefined` or an empty string.
 */

export interface Genre {
  id: number;
  name: string;
}

export interface FilmSummary {
  id: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  /** Average vote (0–10), `null` when the film has no votes yet. */
  rating: number | null;
  genreIds: number[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profilePath: string | null;
}

export interface FilmDetails extends Omit<FilmSummary, 'genreIds'> {
  overview: string | null;
  tagline: string | null;
  backdropPath: string | null;
  genres: Genre[];
  /** ISO date (`YYYY-MM-DD`). */
  releaseDate: string | null;
  runtimeMinutes: number | null;
  voteCount: number;
  /** ISO 639-1 code, e.g. `en`. */
  originalLanguage: string | null;
  directors: string[];
  /** Top-billed cast, in billing order. */
  cast: CastMember[];
}
