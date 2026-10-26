import { defineConfig } from 'vitest/config';

// Subir o PostgreSQL em memória (PGlite) leva alguns segundos com a máquina ocupada.
export default defineConfig({
  test: { testTimeout: 20_000, hookTimeout: 30_000 },
});
