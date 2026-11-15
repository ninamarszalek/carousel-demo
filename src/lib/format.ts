/**
 * Formatting helpers. They use a fixed locale and the UTC time zone, so the server and the
 * browser produce the same text and hydration never mismatches.
 */

const LOCALE = 'en-US';

const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeZone: 'UTC' });
const languageNames = new Intl.DisplayNames([LOCALE], { type: 'language' });

/** `2h 16m`, `45m`. */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${String(rest)}m`;
  }
  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}m`;
}

/** `1999-03-31` → `March 31, 1999`. Invalid dates are returned unchanged. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : dateFormat.format(date);
}

/** `en` → `English`. Unknown codes are returned unchanged. */
export function formatLanguage(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** `8.24` → `8.2`. */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** `1`, `film` → `1 film`; `3`, `film` → `3 films`. */
export function pluralize(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
