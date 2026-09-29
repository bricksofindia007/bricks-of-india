// Added P12 3b: component tests import src files that use the '@/' alias
// (tsconfig paths) and JSX (tsconfig jsx: preserve is for Next, not vitest).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  oxc: { jsx: { runtime: 'automatic' } },
});
