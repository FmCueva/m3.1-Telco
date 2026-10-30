import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Los tests con PostgreSQL vacían las mismas tablas: los archivos corren en serie.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      // El gate de CI exige >= 80 % SOLO con tests unitarios: se excluyen
      // src/api, src/server.ts y setup.ts (cubiertos por contract tests y
      // por el arranque real, no por unit).
      include: [
        'src/domain/**',
        'src/ai/**',
        'src/observability/logger.ts',
        'src/observability/metrics.ts',
      ],
    },
  },
});
