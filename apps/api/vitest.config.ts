import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// O esbuild do Vitest não emite metadados de decoradores, que a injeção de
// dependências do NestJS usa. O SWC emite.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { testTimeout: 20_000, hookTimeout: 30_000 },
});
