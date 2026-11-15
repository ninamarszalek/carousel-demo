import { Outlet, ScrollRestoration, useNavigation } from 'react-router';

import { DocumentTitle } from '../DocumentTitle';
import { Header } from '../Header';

/** The app shell: skip link, header, a progress bar during navigation, and the page. */
export function RootLayout() {
  const isNavigating = useNavigation().state !== 'idle';

  return (
    <div className="app">
      <a className="app__skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <div className="app__progress" data-active={isNavigating || undefined} aria-hidden="true" />
      <main className="app__main" id="main" aria-busy={isNavigating || undefined}>
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

/** The route content with the matching document title; error pages set their own title. */
export function PageOutlet() {
  return (
    <>
      <DocumentTitle />
      <Outlet />
    </>
  );
}
