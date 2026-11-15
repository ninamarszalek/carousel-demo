import type { CastMember, FilmDetails, FilmSummary, Genre } from '@/types/film';

import type {
  TmdbCastMember,
  TmdbCrewMember,
  TmdbGenre,
  TmdbMovieDetails,
  TmdbMovieListItem,
} from './dto';

/** How many cast members the detail page shows. */
export const CAST_LIMIT = 6;

const UNTITLED = 'Untitled';

export function toFilmSummary(movie: TmdbMovieListItem): FilmSummary {
  return {
    id: movie.id,
    title: text(movie.title) ?? UNTITLED,
    posterPath: text(movie.poster_path),
    releaseYear: yearOf(movie.release_date),
    rating: ratingOf(movie.vote_average, movie.vote_count),
    genreIds: movie.genre_ids ?? [],
  };
}

export function toFilmDetails(movie: TmdbMovieDetails): FilmDetails {
  const releaseDate = text(movie.release_date);

  return {
    id: movie.id,
    title: text(movie.title) ?? UNTITLED,
    posterPath: text(movie.poster_path),
    backdropPath: text(movie.backdrop_path),
    releaseYear: yearOf(releaseDate),
    releaseDate,
    rating: ratingOf(movie.vote_average, movie.vote_count),
    voteCount: movie.vote_count ?? 0,
    overview: text(movie.overview),
    tagline: text(movie.tagline),
    runtimeMinutes: movie.runtime && movie.runtime > 0 ? movie.runtime : null,
    originalLanguage: text(movie.original_language),
    genres: (movie.genres ?? []).flatMap(toGenre),
    directors: directorsOf(movie.credits?.crew ?? []),
    cast: (movie.credits?.cast ?? [])
      .toSorted((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .slice(0, CAST_LIMIT)
      .flatMap(toCastMember),
  };
}

/** The summary of a film we only have details for (used by the wish list). */
export function detailsToSummary(film: FilmDetails): FilmSummary {
  return {
    id: film.id,
    title: film.title,
    posterPath: film.posterPath,
    releaseYear: film.releaseYear,
    rating: film.rating,
    genreIds: film.genres.map((genre) => genre.id),
  };
}

function toGenre(genre: TmdbGenre): Genre[] {
  const name = text(genre.name);
  return name ? [{ id: genre.id, name }] : [];
}

function toCastMember(member: TmdbCastMember): CastMember[] {
  const name = text(member.name);
  if (!name) {
    return [];
  }
  return [
    {
      id: member.id,
      name,
      character: text(member.character),
      profilePath: text(member.profile_path),
    },
  ];
}

function directorsOf(crew: readonly TmdbCrewMember[]): string[] {
  const names = crew
    .filter((member) => member.job === 'Director')
    .map((member) => text(member.name))
    .filter((name) => name !== null);
  return [...new Set(names)];
}

/** Trims a string; empty or missing values become `null`. */
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function yearOf(date: string | null | undefined): number | null {
  const year = Number.parseInt(date?.slice(0, 4) ?? '', 10);
  return Number.isNaN(year) ? null : year;
}

function ratingOf(
  average: number | null | undefined,
  count: number | null | undefined,
): number | null {
  if (!count || average === null || average === undefined) {
    return null;
  }
  return Math.round(average * 10) / 10;
}
