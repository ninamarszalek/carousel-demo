import { useEffect } from 'react';
import { useMatches } from 'react-router';

import { buildHead, documentTitle } from './head';

interface DocumentTitleProps {
  /** Set when the page shows an error instead of route content. */
  errorStatus?: number | null;
}

/**
 * Keeps `document.title` in sync after client-side navigation. On the first request the server
 * already put the full head (incl. meta tags for bots) into the HTML, from the same `buildHead()`.
 */
export function DocumentTitle({ errorStatus = null }: DocumentTitleProps) {
  const title = documentTitle(buildHead(useMatches(), errorStatus));

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
