export const SITE_NAME = 'Film Browser';
export const SITE_DESCRIPTION = 'Browse films by category and build your wish list.';

export interface HeadData {
  /** The page title without the site name; `null` on the homepage. */
  title: string | null;
  description: string;
  /** Absolute image URL for link previews. */
  image: string | null;
  /** The one URL of this content (e.g. a film page without `?category`). */
  canonicalPath: string | null;
}

type HeadFields = Partial<HeadData>;

/** `handle` of a route. React Router passes it through untouched; `buildHead()` reads it. */
export interface RouteHandle {
  head?: (loaderData: unknown) => HeadFields;
}

/** Types a route's head function against its loader data. */
// `Data` only types the callback: it is the one place where loader data gets its type back.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function defineHead<Data>(head: (data: Data) => HeadFields): RouteHandle {
  return { head: (loaderData) => head(loaderData as Data) };
}

/** What `buildHead()` needs from a route match; the server and the browser both have it. */
export interface HeadMatch {
  handle: unknown;
  loaderData: unknown;
}

const DEFAULT_HEAD: HeadData = {
  title: null,
  description: SITE_DESCRIPTION,
  image: null,
  canonicalPath: null,
};

/**
 * The head of the current page: route head functions applied from the root down, so deeper routes
 * win. When the page shows an error, only the error title is used.
 */
export function buildHead(matches: readonly HeadMatch[], errorStatus: number | null): HeadData {
  if (errorStatus !== null) {
    return {
      ...DEFAULT_HEAD,
      title: errorStatus === 404 ? 'Page not found' : 'Something went wrong',
    };
  }

  let head = DEFAULT_HEAD;
  for (const { handle, loaderData } of matches) {
    const routeHead = (handle as RouteHandle | undefined)?.head;
    if (routeHead && loaderData !== undefined) {
      head = { ...head, ...routeHead(loaderData) };
    }
  }
  return head;
}

export function documentTitle(head: HeadData): string {
  return head.title ? `${head.title} · ${SITE_NAME}` : SITE_NAME;
}

/** Server only: the head tags as escaped HTML, for the template's `<!--app-head-->` slot. */
export function serializeHead(head: HeadData): string {
  const title = documentTitle(head);
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(head.description)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(head.description)}" />`,
  ];
  if (head.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(head.image)}" />`);
  }
  if (head.canonicalPath) {
    tags.push(`<link rel="canonical" href="${escapeHtml(head.canonicalPath)}" />`);
  }
  return tags.join('\n    ');
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
