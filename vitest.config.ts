import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      test: {
        projects: [
          {
            extends: true,
            test: {
              name: 'client',
              environment: 'jsdom',
              include: ['src/**/*.test.{ts,tsx}'],
              // SSR tests run in the node project below.
              exclude: ['src/**/*.ssr.test.{ts,tsx}'],
              setupFiles: ['tests/setup/client.ts'],
            },
          },
          {
            extends: true,
            test: {
              name: 'server',
              environment: 'node',
              include: ['server/**/*.test.ts', 'src/**/*.ssr.test.{ts,tsx}'],
            },
          },
        ],
        coverage: {
          provider: 'v8',
          reporter: [['text', { skipFull: false }], 'html'],
          include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
          // Process entry points and lifecycle glue are covered by the e2e tests instead.
          exclude: [
            '**/*.test.{ts,tsx}',
            'src/entry-client.tsx',
            'server/dev.ts',
            'server/prod.ts',
            'server/production.ts',
            'server/lifecycle.ts',
          ],
        },
      },
    }),
  ),
);
