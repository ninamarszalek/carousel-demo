import { StrictMode } from 'react';
import {
  renderToPipeableStream,
  type PipeableStream,
  type RenderToPipeableStreamOptions,
} from 'react-dom/server';

import { App } from '@/app/App';

/**
 * Server entry: renders the app for a given URL into a Node stream.
 * Implements the `SsrEntry` contract from `server/render.ts`.
 * `url` is not used yet; it will drive the router once routing is added.
 */
export function render(_url: string, options: RenderToPipeableStreamOptions): PipeableStream {
  return renderToPipeableStream(
    <StrictMode>
      <App />
    </StrictMode>,
    options,
  );
}
