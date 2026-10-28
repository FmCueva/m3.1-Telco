// src/server.ts — arranque del API en el puerto 8080 (lo usa el HEALTHCHECK del Dockerfile).

import { buildApp } from './api/app';

const app = buildApp({ logger: true });

app.listen({ port: 8080, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
