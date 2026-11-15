import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * One config, two builds:
 * - client build (`vite build`)       → dist/client: browser assets + processed index.html template
 * - server build (`vite build --ssr`) → dist/server: Node server + SSR render entry
 */
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  resolve: {
    // Reuse the `@/*` alias from tsconfig instead of declaring it twice.
    tsconfigPaths: true,
  },
  build: isSsrBuild
    ? {
        outDir: 'dist/server',
        target: 'node24',
        // public/ is served from the client build only.
        copyPublicDir: false,
        rolldownOptions: {
          input: {
            index: 'server/prod.ts',
            'entry-server': 'src/entry-server.tsx',
          },
        },
      }
    : {
        outDir: 'dist/client',
      },
}));
