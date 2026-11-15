import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { App } from '@/app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing in index.html.');
}

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// When SSR of the shell fails, the server sends an empty #root (see server/render.ts).
// In that case render on the client instead of hydrating, so the page still works.
if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
