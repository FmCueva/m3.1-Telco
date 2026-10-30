// tests/contract/incidents.classification.test.ts — flujo incidencia → IA → técnico, de punta a punta.
// El clasificador se inyecta falso (0 tokens): aquí se prueba el flujo HTTP, no el modelo.

import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetLogSink, setLogSink } from '../../src/observability/logger';
import { buildTestApp, seed } from '../helpers/testApp';

type Outcome =
  | {
      kind: 'suggestion';
      suggestion: { category: string; confidence: number; suggestedResolution: string };
      model: string;
    }
  | { kind: 'manual_review'; reason: string; model: string };

const SUGGESTION: Outcome = {
  kind: 'suggestion',
  suggestion: {
    category: 'BILLING',
    confidence: 0.92,
    suggestedResolution: 'Revisar factura.',
  },
  model: 'claude-haiku-4-5',
};
const LOW_CONFIDENCE: Outcome = {
  kind: 'manual_review',
  reason: 'low_confidence',
  model: 'claude-haiku-4-5',
};

let current: FastifyInstance | undefined;

async function setup(outcome: Outcome) {
  const classifier = vi.fn().mockResolvedValue(outcome);
  const app = await buildTestApp({ classifier });
  current = app;
  const contract = await seed.contract(app, { status: 'ACTIVE' });
  return { app, classifier, contract };
}

afterEach(async () => {
  resetLogSink();
  await current?.close();
});

describe('POST /incidents con clasificador', () => {
  // @AC-TELCO-004
  it('confianza baja → incidencia en MANUAL_REVIEW, sin sugerencia y sin tocar el servicio', async () => {
    const { app, contract } = await setup(LOW_CONFIDENCE);

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id, description: 'Cobro raro' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ status: 'MANUAL_REVIEW' });
    expect(app.store.getIncident(res.json().id)?.manualReviewAt).toEqual(
      expect.any(String),
    ); // @AC-TELCO-013
    expect(res.json().suggestion).toBeUndefined();
    expect(app.store.getContract(contract.id)).toEqual(contract);
  });

  it('salida inválida de la IA → MANUAL_REVIEW', async () => {
    const { app, contract } = await setup({
      kind: 'manual_review',
      reason: 'invalid_output',
      model: 'claude-haiku-4-5',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id, description: 'x' },
    });

    expect(res.json()).toMatchObject({ status: 'MANUAL_REVIEW' });
  });

  // @AC-TELCO-005
  it('sugerencia válida → incidencia OPEN con suggestionId, sin decisión hasta que el técnico decide', async () => {
    const { app, classifier, contract } = await setup(SUGGESTION);

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id, description: 'Me cobran de más' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('OPEN');
    expect(body.suggestion).toMatchObject({
      suggestionId: expect.any(String),
      category: 'BILLING',
      confidence: 0.92,
      suggestedResolution: 'Revisar factura.',
    });
    expect(classifier).toHaveBeenCalledWith('Me cobran de más');
    expect(app.store.getDecision(body.suggestion.suggestionId)).toBeUndefined();

    const decision = await app.inject({
      method: 'POST',
      url: `/suggestions/${body.suggestion.suggestionId}/decision`,
      payload: { technicianId: 't-17', decision: 'ACCEPTED' },
    });
    expect(decision.statusCode).toBe(201);
  });

  it('descripción ausente → 400 y no se clasifica ni se crea la incidencia', async () => {
    const { app, classifier, contract } = await setup(SUGGESTION);

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id },
    });

    expect(res.statusCode).toBe(400);
    expect(classifier).not.toHaveBeenCalled();
    expect(app.store.listIncidents()).toHaveLength(0);
  });

  // @AC-TELCO-007
  it('servicio CANCELLED → 409 y la IA no se invoca', async () => {
    const { app, classifier } = await setup(SUGGESTION);
    const cancelled = await seed.contract(app, { status: 'CANCELLED' });

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: cancelled.id, description: 'x' },
    });

    expect(res.statusCode).toBe(409);
    expect(classifier).not.toHaveBeenCalled();
  });

  // @AC-TELCO-008
  it('servicio inexistente → 404 y la IA no se invoca', async () => {
    const { app, classifier } = await setup(SUGGESTION);

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: crypto.randomUUID(), description: 'x' },
    });

    expect(res.statusCode).toBe(404);
    expect(classifier).not.toHaveBeenCalled();
  });

  it('el log de la sugerencia no contiene PII aunque la descripción la lleve', async () => {
    const lines: string[] = [];
    setLogSink((l) => lines.push(l));
    const { app, contract } = await setup(SUGGESTION);

    await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: {
        contractId: contract.id,
        description: 'Soy Juan Pérez, tel 600123456, juan@example.com',
      },
    });

    const all = lines.join('\n');
    expect(all).toContain('suggestion_created');
    expect(all).not.toMatch(/Juan|Pérez|600123456|juan@example\.com/);
  });
});

describe('GET /incidents?status=MANUAL_REVIEW', () => {
  it('lista solo la cola de revisión manual', async () => {
    const { app, contract } = await setup(LOW_CONFIDENCE);
    const review = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id, description: 'dudosa' },
    });
    app.store.putIncident({
      id: 'i-open',
      contractId: contract.id,
      description: 'normal',
      status: 'OPEN',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/incidents?status=MANUAL_REVIEW',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().map((i: { id: string }) => i.id)).toEqual([review.json().id]);
  });

  it('estado inválido → 400', async () => {
    const { app } = await setup(LOW_CONFIDENCE);
    const res = await app.inject({ method: 'GET', url: '/incidents?status=NOPE' });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /incidents/:id/resolve', () => {
  async function openIncident(outcome: Outcome = SUGGESTION) {
    const { app, contract } = await setup(outcome);
    const created = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id, description: 'Sin internet' },
    });
    return { app, contract, incident: created.json() };
  }

  // @AC-TELCO-009
  it.each([
    ['OPEN', SUGGESTION],
    ['MANUAL_REVIEW', LOW_CONFIDENCE],
  ] as const)(
    '%s → 200 y RESOLVED con técnico y marca de tiempo',
    async (_s, outcome) => {
      const { app, contract, incident } = await openIncident(outcome);

      const res = await app.inject({
        method: 'POST',
        url: `/incidents/${incident.id}/resolve`,
        payload: { technicianId: 't-17' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: 'RESOLVED', resolvedBy: 't-17' });
      expect(res.json().resolvedAt).toEqual(expect.any(String));
      expect(app.store.getContract(contract.id)?.status).toBe('ACTIVE'); // el servicio no cambia
    },
  );

  // @AC-TELCO-009
  it('resolver deja una entrada de auditoría y un log sin PII', async () => {
    const logs: string[] = [];
    setLogSink((line) => logs.push(line));
    const { app, incident } = await openIncident();

    await app.inject({
      method: 'POST',
      url: `/incidents/${incident.id}/resolve`,
      payload: { technicianId: 't-17' },
    });

    expect(app.store.listAudit().some((a) => a.event === 'incident_resolved')).toBe(
      true,
    );
    expect(logs.join('\n')).toContain('incident_resolved');
    expect(logs.join('\n')).not.toContain('Sin internet');
  });

  // @AC-TELCO-010
  it('resolver dos veces → 409 INCIDENT_ALREADY_RESOLVED y no cambia', async () => {
    const { app, incident } = await openIncident();
    const url = `/incidents/${incident.id}/resolve`;
    const first = await app.inject({
      method: 'POST',
      url,
      payload: { technicianId: 't-17' },
    });

    const second = await app.inject({
      method: 'POST',
      url,
      payload: { technicianId: 't-99' },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ code: 'INCIDENT_ALREADY_RESOLVED' });
    expect(app.store.getIncident(incident.id)).toMatchObject({
      resolvedBy: 't-17',
      resolvedAt: first.json().resolvedAt,
    });
  });

  // @AC-TELCO-011
  it('incidencia inexistente → 404 INCIDENT_NOT_FOUND', async () => {
    const { app } = await setup(SUGGESTION);

    const res = await app.inject({
      method: 'POST',
      url: '/incidents/no-existe/resolve',
      payload: { technicianId: 't-17' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'INCIDENT_NOT_FOUND' });
  });

  // @AC-TELCO-012
  it('sin technicianId → 400 y la incidencia sigue OPEN', async () => {
    const { app, incident } = await openIncident();

    const res = await app.inject({
      method: 'POST',
      url: `/incidents/${incident.id}/resolve`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(app.store.getIncident(incident.id)?.status).toBe('OPEN');
  });
});
