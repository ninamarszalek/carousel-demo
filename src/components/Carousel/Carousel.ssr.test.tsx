import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Carousel } from './Carousel';

function renderOnServer(initialIndex: number) {
  return renderToString(
    <Carousel
      items={['Mercury', 'Venus', 'Earth', 'Mars']}
      getKey={(item) => item}
      getItemLabel={(item) => item}
      itemName="planet"
      labelledBy="planets"
      initialIndex={initialIndex}
      getIndexHref={(index) => `?planets=${String(index)}`}
      renderItem={(item) => <a href={`/planets/${item}`}>{item}</a>}
    />,
  );
}

describe('Carousel on the server', () => {
  it('renders the resting arc, so the HTML is complete before any JavaScript runs', () => {
    const html = renderOnServer(1);

    expect(html).toMatch(/style="--offset:0;z-index:4"[^>]*>.*Venus/);
    expect(html).toMatch(/style="--offset:-1;z-index:3"[^>]*>.*Mercury/);
    expect(html).toContain('--offset:2');
  });

  it('renders the arrows as links to the neighbouring cards (they work without JavaScript)', () => {
    const html = renderOnServer(0);

    expect(html).toContain(
      '<a class="carousel__button carousel__button--previous" href="?planets=3" aria-label="Previous planet">',
    );
    expect(html).toContain(
      '<a class="carousel__button carousel__button--next" href="?planets=1" aria-label="Next planet">',
    );
    expect(html).not.toContain('<button');
  });
});
