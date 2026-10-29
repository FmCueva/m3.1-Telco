// src/server.ts — arranque del API en el puerto 8080 (lo usa el HEALTHCHECK del Dockerfile).

import { classifyIncident } from './ai';
import { buildApp } from './api/app';

// Raíz de composición: único sitio que une la API con el módulo ai (ADR-001).
const app = buildApp({
  logger: true,
  classifier: (description) => classifyIncident(description),
});

app.listen({ port: 8080, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
