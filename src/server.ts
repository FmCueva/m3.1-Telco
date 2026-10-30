// src/server.ts — arranque del API en el puerto 8080 (lo usa el HEALTHCHECK del Dockerfile).

import { startTracing, tracer } from './observability/tracing';

startTracing(); // antes de cargar fastify/http

import { classifyUnlessDisabled } from './ai';
import { buildApp } from './api/app';
import { PgStore } from './api/pgStore';

// Raíz de composición: único sitio que une la API con el módulo ai (ADR-001).
const app = buildApp({
  logger: true,
  // Con DATABASE_URL persiste en PostgreSQL; sin ella, DB en memoria (demo).
  store: process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : undefined,
  webhookSecret: process.env.WEBHOOK_SECRET,
  classifier: (description) =>
    tracer().startActiveSpan('ai.classify_incident', async (span) => {
      try {
        const result = await classifyUnlessDisabled(description);
        span.setAttribute('ai.outcome', result.kind); // sin la descripción: nunca PII
        return result;
      } finally {
        span.end();
      }
    }),
});

app.listen({ port: 8080, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
