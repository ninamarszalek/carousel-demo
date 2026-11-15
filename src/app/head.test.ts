import { describe, expect, it } from 'vitest';

import { buildHead, defineHead, documentTitle, serializeHead, SITE_DESCRIPTION } from './head';

describe('buildHead', () => {
  it('uses the site defaults when no route defines a head', () => {
    expect(buildHead([{ handle: undefined, loaderData: {} }], null)).toStrictEqual({
      title: null,
      description: SITE_DESCRIPTION,
      image: null,
      canonicalPath: null,
    });
  });

  it('applies route heads from the root down, so deeper routes win', () => {
    const parent = defineHead<{ name: string }>(({ name }) => ({
      title: name,
      description: 'Parent',
    }));
    const child = defineHead<{ name: string }>(({ name }) => ({ title: name }));

    const head = buildHead(
      [
        { handle: parent, loaderData: { name: 'Parent' } },
        { handle: child, loaderData: { name: 'Child' } },
      ],
      null,
    );

    expect(head).toMatchObject({ title: 'Child', description: 'Parent' });
  });

  it('skips routes whose data is missing', () => {
    const head = buildHead(
      [{ handle: defineHead(() => ({ title: 'Film' })), loaderData: undefined }],
      null,
    );

    expect(head.title).toBeNull();
  });

  it.each([
    [404, 'Page not found'],
    [502, 'Something went wrong'],
  ])('uses the error title for status %i', (status, title) => {
    const film = defineHead(() => ({ title: 'Film' }));

    expect(buildHead([{ handle: film, loaderData: {} }], status).title).toBe(title);
  });
});

describe('documentTitle', () => {
  it('adds the site name to page titles', () => {
    expect(documentTitle({ ...buildHead([], null), title: 'Wish list' })).toBe(
      'Wish list · Film Browser',
    );
    expect(documentTitle(buildHead([], null))).toBe('Film Browser');
  });
});

describe('serializeHead', () => {
  it('renders title, description, Open Graph tags and the canonical link', () => {
    const tags = serializeHead({
      title: 'The Matrix (1999)',
      description: 'A hacker learns the truth.',
      image: 'https://image.tmdb.org/t/p/w1280/x.jpg',
      canonicalPath: '/film/603',
    });

    expect(tags).toContain('<title>The Matrix (1999) · Film Browser</title>');
    expect(tags).toContain('<meta name="description" content="A hacker learns the truth." />');
    expect(tags).toContain(
      '<meta property="og:title" content="The Matrix (1999) · Film Browser" />',
    );
    expect(tags).toContain(
      '<meta property="og:image" content="https://image.tmdb.org/t/p/w1280/x.jpg" />',
    );
    expect(tags).toContain('<link rel="canonical" href="/film/603" />');
  });

  it('escapes HTML in data from TMDB', () => {
    const tags = serializeHead({
      title: '</title><script>alert(1)</script>',
      description: '"quoted" & <b>bold</b>',
      image: null,
      canonicalPath: null,
    });

    expect(tags).not.toContain('<script>');
    expect(tags).toContain('&lt;/title&gt;&lt;script&gt;');
    expect(tags).toContain('content="&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;"');
    expect(tags).not.toContain('og:image');
    expect(tags).not.toContain('canonical');
  });
});
