// tests/contract/metrics.api.test.ts — GET /metrics (formato texto de Prometheus).
// Las métricas son AGREGADAS: nunca por técnico (EU AI Act, Anexo III punto 4).

import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, seed } from '../helpers/testApp';

const SUGGESTION = {
  kind: 'suggestion' as const,
  suggestion: {
    category: 'BILLING',
    confidence: 0.92,
    suggestedResolution: 'Revisar factura.',
  },
  model: 'claude-haiku-4-5',
};

let current: FastifyInstance | undefined;

async function setup() {
  const app = await buildTestApp({ classifier: vi.fn().mockResolvedValue(SUGGESTION) });
  current = app;
  const contract = await seed.contract(app, { status: 'ACTIVE' });
  return { app, contract };
}

async function openIncident(app: FastifyInstance, contractId: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/incidents',
    payload: { contractId, description: 'Me cobran de más' },
  });
  return res.json().suggestion.suggestionId as string;
}

async function decide(
  app: FastifyInstance,
  id: string,
  decision: string,
  technicianId = 't-17',
) {
  await app.inject({
    method: 'POST',
    url: `/suggestions/${id}/decision`,
    payload: { technicianId, decision },
  });
}

async function metrics(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/metrics' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toContain('text/plain');
  return res.body;
}

afterEach(async () => {
  await current?.close();
});

describe('GET /metrics', () => {
  it('ai_acceptance_rate = ACCEPTED / total de decisiones', async () => {
    const { app, contract } = await setup();
    await decide(app, await openIncident(app, contract.id), 'ACCEPTED');
    await decide(app, await openIncident(app, contract.id), 'REJECTED', 't-99');

    const body = await metrics(app);

    expect(body).toMatch(/^ai_acceptance_rate 0\.5$/m);
    expect(body).toMatch(/^ai_decisions_total 2$/m);
  });

  it('sin decisiones no publica ai_acceptance_rate (sin tasa que reportar)', async () => {
    const { app } = await setup();

    const body = await metrics(app);

    expect(body).toContain('# TYPE ai_acceptance_rate gauge');
    expect(body).not.toMatch(/^ai_acceptance_rate /m);
  });

  it('audit_log_completeness = 1 cuando cada sugerencia y decisión queda auditada', async () => {
    const { app, contract } = await setup();
    await decide(app, await openIncident(app, contract.id), 'MODIFIED');
    await openIncident(app, contract.id);

    expect(await metrics(app)).toMatch(/^audit_log_completeness 1$/m);
  });

  it('audit_log_completeness < 1 si hay una sugerencia sin registro de auditoría', async () => {
    const { app, contract } = await setup();
    await openIncident(app, contract.id);
    await seed.suggestion(app); // sembrada directo en el store: no pasó por la API, sin auditoría

    expect(await metrics(app)).toMatch(/^audit_log_completeness 0\.5$/m);
  });

  it('no expone identificadores de técnicos ni de sugerencias (solo agregados)', async () => {
    const { app, contract } = await setup();
    await decide(app, await openIncident(app, contract.id), 'ACCEPTED', 't-17');

    const body = await metrics(app);

    expect(body).not.toContain('t-17');
    expect(body).not.toMatch(/technician/i);
  });

  describe('incident_manual_review_resolution_seconds (NFR-OPS-001)', () => {
    const HOURS = 3_600_000;

    async function resolveSeeded(
      app: FastifyInstance,
      contractId: string,
      data: { status: 'OPEN' | 'MANUAL_REVIEW'; manualReviewAt?: string },
    ) {
      const incident = app.store.putIncident({
        id: crypto.randomUUID(),
        contractId,
        description: 'Sin servicio',
        ...data,
      });
      await app.inject({
        method: 'POST',
        url: `/incidents/${incident.id}/resolve`,
        payload: { technicianId: 't-17' },
      });
    }

    // @AC-TELCO-013
    it('resuelta tras 5 h → cuenta en +Inf y fuera del bucket de 4 h', async () => {
      const { app, contract } = await setup();
      await resolveSeeded(app, contract.id, {
        status: 'MANUAL_REVIEW',
        manualReviewAt: new Date(Date.now() - 5 * HOURS).toISOString(),
      });

      const body = await metrics(app);

      expect(body).toMatch(
        /^incident_manual_review_resolution_seconds_bucket\{le="14400"\} 0$/m,
      );
      expect(body).toMatch(
        /^incident_manual_review_resolution_seconds_bucket\{le="\+Inf"\} 1$/m,
      );
      expect(body).toMatch(/^incident_manual_review_resolution_seconds_count 1$/m);
    });

    // @AC-TELCO-013
    it('resuelta tras 1 h → dentro del bucket de 4 h', async () => {
      const { app, contract } = await setup();
      await resolveSeeded(app, contract.id, {
        status: 'MANUAL_REVIEW',
        manualReviewAt: new Date(Date.now() - 1 * HOURS).toISOString(),
      });

      expect(await metrics(app)).toMatch(
        /^incident_manual_review_resolution_seconds_bucket\{le="14400"\} 1$/m,
      );
    });

    // @AC-TELCO-014
    it('incidencia que nunca estuvo en MANUAL_REVIEW → count 0', async () => {
      const { app, contract } = await setup();
      await resolveSeeded(app, contract.id, { status: 'OPEN' });

      expect(await metrics(app)).toMatch(
        /^incident_manual_review_resolution_seconds_count 0$/m,
      );
    });
  });
});
