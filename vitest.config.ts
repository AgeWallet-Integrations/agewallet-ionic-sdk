import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const mock = (file: string) => fileURLToPath(new URL(`./tests/mocks/${file}`, import.meta.url));

// Vitest for the SDK's TypeScript in src/, run in Node. The three Capacitor plugins the SDK imports are replaced
// by the in-memory stand-ins in tests/mocks/, and tests/setup.ts fails any test that calls fetch without a stub.
// `npx vitest run --coverage` prints line coverage of src/ and writes it to coverage/coverage.txt.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    alias: {
      '@capacitor/app': mock('capacitor-app.ts'),
      '@capacitor/browser': mock('capacitor-browser.ts'),
      '@capacitor/preferences': mock('capacitor-preferences.ts'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', ['text', { file: 'coverage.txt' }]],
    },
  },
});
