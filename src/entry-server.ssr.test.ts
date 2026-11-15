import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { render } from './entry-server';

/** Renders the app like the server does, but waits for everything (incl. Suspense) to be ready. */
function renderToHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        html += chunk.toString();
        callback();
      },
      final(callback) {
        resolve(html);
        callback();
      },
    });

    const stream = render(url, {
      onAllReady() {
        stream.pipe(sink);
      },
      onShellError: reject,
      onError: reject,
    });
  });
}

describe('entry-server render()', () => {
  it('renders the app to HTML', async () => {
    const html = await renderToHtml('/');

    expect(html).toContain('<h1 class="app__title">Film Browser</h1>');
    expect(html).toContain('<main class="app__main">');
  });
});
