import { tmdbImage, type TmdbImageKind } from '@/lib/tmdb-image';

interface TmdbImageProps {
  /** A TMDB image path such as `/abc.jpg`. */
  path: string;
  kind: TmdbImageKind;
  alt: string;
  className: string;
  /** The `sizes` attribute: how wide the image is rendered. */
  sizes: string;
  /** Intrinsic size, so the browser reserves the space before the image loads. */
  width: number;
  height: number;
  /** Above the fold: load eagerly and first. The rest load lazily. */
  priority?: boolean;
}

/** A responsive `<img>` for a TMDB image, with a `srcSet` of every width TMDB serves. */
export function TmdbImage({
  path,
  kind,
  alt,
  className,
  sizes,
  width,
  height,
  priority = false,
}: TmdbImageProps) {
  const { src, srcSet } = tmdbImage(path, kind);

  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
    />
  );
}
