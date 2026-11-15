import { formatDate, formatLanguage, formatRating, formatRuntime, pluralize } from '@/lib/format';
import type { FilmDetails } from '@/types/film';

interface FilmInfoProps {
  film: FilmDetails;
  className: string;
}

/** The "additional info" area: facts as a description list, then the top-billed cast. */
export function FilmInfo({ film, className }: FilmInfoProps) {
  const facts: [term: string, value: string | null][] = [
    ['Release date', film.releaseDate && formatDate(film.releaseDate)],
    ['Runtime', film.runtimeMinutes === null ? null : formatRuntime(film.runtimeMinutes)],
    [
      'Rating',
      film.rating === null
        ? null
        : `${formatRating(film.rating)} / 10 (${pluralize(film.voteCount, 'vote')})`,
    ],
    ['Genres', film.genres.map((genre) => genre.name).join(', ') || null],
    ['Original language', film.originalLanguage && formatLanguage(film.originalLanguage)],
    [film.directors.length > 1 ? 'Directors' : 'Director', film.directors.join(', ') || null],
  ];

  return (
    <section className={`film-info ${className}`} aria-labelledby="film-info-title">
      <h2 className="film-info__title" id="film-info-title">
        Details
      </h2>
      <dl className="film-info__facts">
        {facts
          .filter(([, value]) => value !== null)
          .map(([term, value]) => (
            <div key={term} className="film-info__fact">
              <dt className="film-info__term">{term}</dt>
              <dd className="film-info__value">{value}</dd>
            </div>
          ))}
      </dl>

      {film.cast.length > 0 && (
        <>
          <h3 className="film-info__subtitle">Cast</h3>
          <ul className="film-info__cast">
            {film.cast.map((member) => (
              <li key={member.id} className="film-info__cast-member">
                <span className="film-info__actor">{member.name}</span>
                {member.character && (
                  <span className="film-info__character">{member.character}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
