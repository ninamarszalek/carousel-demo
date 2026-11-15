/**
 * TMDB API response shapes (https://developer.themoviedb.org/reference), limited to the fields we
 * use. Every field is optional or nullable: TMDB data is user-edited, so the mappers never trust it.
 */

export interface TmdbMovieListItem {
  id: number;
  title?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  genre_ids?: number[] | null;
}

export interface TmdbPagedResponse<T> {
  page: number;
  results?: T[] | null;
  total_pages?: number;
  total_results?: number;
}

export interface TmdbGenre {
  id: number;
  name?: string | null;
}

export interface TmdbCastMember {
  id: number;
  name?: string | null;
  character?: string | null;
  profile_path?: string | null;
  order?: number | null;
}

export interface TmdbCrewMember {
  id: number;
  name?: string | null;
  job?: string | null;
}

export interface TmdbMovieDetails {
  id: number;
  title?: string | null;
  overview?: string | null;
  tagline?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  original_language?: string | null;
  genres?: TmdbGenre[] | null;
  /** Present when requested with `append_to_response=credits`. */
  credits?: {
    cast?: TmdbCastMember[] | null;
    crew?: TmdbCrewMember[] | null;
  } | null;
}
