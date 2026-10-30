// tests/contract/contracts.api.test.ts — CONTRATO HTTP (specs/spec-servicio.md 2.1 y src/api/openapi.yaml).
// Verifica la promesa hecha a quien consume el API (status + { code, message }), no la
// implementación: si se refactoriza el dominio, estos tests no se tocan.

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, seed } from '../helpers/testApp';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('POST /contracts', () => {
  // @AC-TELCO-003
  it('cliente sin KYC verificado → 403 KYC_REQUIRED y no se crea ningún servicio', async () => {
    const customer = await seed.customer(app, { status: 'PENDING' });

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      payload: { customerId: customer.id, type: 'FIBER' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'KYC_REQUIRED' });
    expect(await app.store.listContractsByCustomer(customer.id)).toEqual([]);
  });

  // @AC-TELCO-006
  it('cliente con deuda → 409 DEBT_OUTSTANDING y no se crea ningún servicio', async () => {
    const customer = await seed.customer(app, {
      status: 'VERIFIED',
      outstandingDebt: 50,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      payload: { customerId: customer.id, type: 'FIBER' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'DEBT_OUTSTANDING' });
    expect(await app.store.listContractsByCustomer(customer.id)).toEqual([]);
  });
});

describe('POST /contracts/:id/events', () => {
  // @AC-TELCO-002
  it('transición inválida → 409 INVALID_TRANSITION y el estado NO cambia', async () => {
    // CANCELLED es terminal: ni siquiera CANCEL es válido desde ahí (INV-2, INV-3).
    const contract = await seed.contract(app, { status: 'CANCELLED' });

    const res = await app.inject({
      method: 'POST',
      url: `/contracts/${contract.id}/events`,
      payload: { event: 'cancel' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'INVALID_TRANSITION' });

    const after = await app.inject({ method: 'GET', url: `/contracts/${contract.id}` });
    expect(after.json()).toMatchObject({ id: contract.id, status: 'CANCELLED' });
  });
});

describe('POST /contracts/:id/events no admite eventos de sistemas externos (NFR-SEC-001)', () => {
  // @AC-TELCO-015
  it.each([
    ['PENDING_INSTALLATION', 'installationCompleted'],
    ['ACTIVE', 'paymentDefault'],
    ['SUSPENDED', 'paymentRegularized'],
  ] as const)(
    '%s + %s sin firma → 400 y el estado NO cambia',
    async (status, event) => {
      const contract = await seed.contract(app, { status });

      const res = await app.inject({
        method: 'POST',
        url: `/contracts/${contract.id}/events`,
        payload: { event },
      });

      expect(res.statusCode).toBe(400);
      expect((await app.store.getContract(contract.id))?.status).toBe(status);
    },
  );
});

describe('POST /incidents', () => {
  // @AC-TELCO-008
  it('servicio inexistente → 404 con shape { code, message } y no se crea incidencia', async () => {
    const before = (await app.store.listIncidents()).length;

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: crypto.randomUUID(), description: 'Sin servicio' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: expect.any(String),
      message: expect.any(String),
    });
    expect(await app.store.listIncidents()).toHaveLength(before);
  });

  // @AC-TELCO-007
  it('servicio CANCELLED → 409 SERVICE_CANCELLED y no se crea incidencia', async () => {
    const contract = await seed.contract(app, { status: 'CANCELLED' });
    const before = (await app.store.listIncidents()).length;

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id, description: 'Sin servicio' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'SERVICE_CANCELLED' });
    expect(await app.store.listIncidents()).toHaveLength(before);
  });
});

describe('POST /suggestions/:id/decision', () => {
  // @AC-TELCO-005
  it.each(['ACCEPTED', 'MODIFIED', 'REJECTED'] as const)(
    'decisión %s → 201 y registro con suggestion_id, técnico, decisión y timestamp',
    async (decision) => {
      const suggestion = await seed.suggestion(app);

      const res = await app.inject({
        method: 'POST',
        url: `/suggestions/${suggestion.id}/decision`,
        payload: { technicianId: 't-17', decision },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        suggestionId: suggestion.id,
        technicianId: 't-17',
        decision,
        decidedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(await app.store.getDecision(suggestion.id)).toMatchObject({ decision });
    },
  );

  // @AC-TELCO-005
  it('decisión fuera del enum o sin técnico → 400 y no se registra nada', async () => {
    const suggestion = await seed.suggestion(app);

    const badDecision = await app.inject({
      method: 'POST',
      url: `/suggestions/${suggestion.id}/decision`,
      payload: { technicianId: 't-17', decision: 'MAYBE' },
    });
    const noTechnician = await app.inject({
      method: 'POST',
      url: `/suggestions/${suggestion.id}/decision`,
      payload: { decision: 'ACCEPTED' },
    });

    expect(badDecision.statusCode).toBe(400);
    expect(noTechnician.statusCode).toBe(400);
    expect(await app.store.getDecision(suggestion.id)).toBeUndefined();
  });

  // @AC-TELCO-005
  it('sugerencia inexistente → 404 y no se registra nada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/suggestions/${crypto.randomUUID()}/decision`,
      payload: { technicianId: 't-17', decision: 'ACCEPTED' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'SUGGESTION_NOT_FOUND' });
  });

  // @AC-TELCO-005
  it('sugerencia ya decidida → 409 y se conserva la primera decisión', async () => {
    const suggestion = await seed.suggestion(app);
    const url = `/suggestions/${suggestion.id}/decision`;
    await app.inject({
      method: 'POST',
      url,
      payload: { technicianId: 't-17', decision: 'ACCEPTED' },
    });

    const res = await app.inject({
      method: 'POST',
      url,
      payload: { technicianId: 't-99', decision: 'REJECTED' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'SUGGESTION_ALREADY_DECIDED' });
    expect(await app.store.getDecision(suggestion.id)).toMatchObject({
      technicianId: 't-17',
      decision: 'ACCEPTED',
    });
  });
});
