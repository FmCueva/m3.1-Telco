// tests/e2e/happy-path.e2e.test.ts — flujo feliz completo, solo por HTTP (sin sembrar el store).
// El clasificador se inyecta falso (0 tokens): se prueba el flujo, no el modelo.

import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backends } from '../helpers/stores';
import { buildTestApp } from '../helpers/testApp';

const HIGH = {
  kind: 'suggestion' as const,
  suggestion: {
    category: 'BILLING',
    confidence: 0.92,
    suggestedResolution: 'Revisar.',
  },
  model: 'claude-haiku-4-5',
};
const LOW = {
  kind: 'manual_review' as const,
  reason: 'low_confidence',
  model: 'claude-haiku-4-5',
};

let current: FastifyInstance | undefined;

async function post(app: FastifyInstance, url: string, payload: object = {}) {
  return app.inject({ method: 'POST', url, payload });
}

// Cliente verificado con un servicio ACTIVE, creado solo con llamadas a la API.
async function activeService(app: FastifyInstance) {
  const customer = (await post(app, '/customers')).json();
  const pending = await post(app, '/contracts', {
    customerId: customer.id,
    type: 'FIBER',
  });
  expect(pending.statusCode).toBe(403); // @AC-TELCO-003: KYC aún PENDING
  await post(app, `/customers/${customer.id}/kyc`, { result: 'VERIFIED' });
  const contract = (
    await post(app, '/contracts', { customerId: customer.id, type: 'FIBER' })
  ).json();
  await post(app, `/contracts/${contract.id}/events`, { event: 'confirm' });
  await post(app, `/contracts/${contract.id}/events`, {
    event: 'installationCompleted',
  });
  return contract.id as string;
}

afterEach(async () => {
  await current?.close();
});

describe.each(backends)('flujo feliz completo ($name)', (backend) => {
  let dispose: (() => Promise<void>) | undefined;
  afterEach(async () => dispose?.());

  async function appWith(classifier: ReturnType<typeof vi.fn>) {
    const opened = await backend.open();
    dispose = opened.dispose;
    return buildTestApp({ classifier, store: opened.store });
  }

  // @AC-TELCO-003 @AC-TELCO-004 @AC-TELCO-009 @AC-TELCO-013
  it('cliente → KYC → servicio ACTIVE → incidencia en MANUAL_REVIEW → resuelta → métrica', async () => {
    const app = await appWith(vi.fn().mockResolvedValue(LOW));
    current = app;
    const contractId = await activeService(app);
    expect((await app.inject({ url: `/contracts/${contractId}` })).json().status).toBe(
      'ACTIVE',
    );

    const incident = (
      await post(app, '/incidents', { contractId, description: 'Sin internet' })
    ).json();
    expect(incident.status).toBe('MANUAL_REVIEW');
    const queue = await app.inject({ url: '/incidents?status=MANUAL_REVIEW' });
    expect(queue.json().map((i: { id: string }) => i.id)).toContain(incident.id);

    const resolved = await post(app, `/incidents/${incident.id}/resolve`, {
      technicianId: 't-17',
    });
    expect(resolved.json()).toMatchObject({ status: 'RESOLVED', resolvedBy: 't-17' });

    const { body } = await app.inject({ url: '/metrics' });
    expect(body).toMatch(/^incident_manual_review_resolution_seconds_count 1$/m);
    expect(body).toMatch(
      /^incident_manual_review_resolution_seconds_bucket\{le="14400"\} 1$/m,
    );
  });

  // @AC-TELCO-005 @AC-TELCO-002 @AC-TELCO-007
  it('sugerencia decidida por el técnico y servicio cancelado (terminal) sin nuevas incidencias', async () => {
    const app = await appWith(vi.fn().mockResolvedValue(HIGH));
    current = app;
    const contractId = await activeService(app);

    const incident = (
      await post(app, '/incidents', { contractId, description: 'Cobro raro' })
    ).json();
    expect(incident.status).toBe('OPEN');
    const decision = await post(
      app,
      `/suggestions/${incident.suggestion.suggestionId}/decision`,
      {
        technicianId: 't-17',
        decision: 'ACCEPTED',
      },
    );
    expect(decision.statusCode).toBe(201);
    expect((await app.inject({ url: '/metrics' })).body).toMatch(
      /^ai_acceptance_rate 1$/m,
    );

    await post(app, `/contracts/${contractId}/events`, { event: 'cancel' });
    const again = await post(app, `/contracts/${contractId}/events`, {
      event: 'confirm',
    });
    expect(again.statusCode).toBe(409);
    const blocked = await post(app, '/incidents', { contractId, description: 'Otra' });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ code: 'SERVICE_CANCELLED' });
  });
});
