import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Node by default. UI tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    // The first test to import a route handler pulls in a large module graph;
    // on a cold cache that alone can exceed the 5s default on Windows.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
      // The real package throws outside a server component graph; see the stub.
      'server-only': `${import.meta.dirname}/tests/stubs/server-only.ts`,
    },
  },
});
