import { formatRating, formatRuntime } from '@/lib/format';

interface FactSource {
  releaseYear: number | null;
  rating: number | null;
  runtimeMinutes?: number | null;
}

/** The year, runtime (when given) and rating of a film, skipping the unknown ones. */
export function filmFacts({ releaseYear, rating, runtimeMinutes = null }: FactSource): string[] {
  return [
    releaseYear === null ? null : String(releaseYear),
    runtimeMinutes === null ? null : formatRuntime(runtimeMinutes),
    rating === null ? null : `★ ${formatRating(rating)}`,
  ].filter((fact) => fact !== null);
}
