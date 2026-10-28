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
    expect(app.store.listContractsByCustomer(customer.id)).toEqual([]);
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
    expect(app.store.listContractsByCustomer(customer.id)).toEqual([]);
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

describe('POST /incidents', () => {
  // @AC-TELCO-008
  it('servicio inexistente → 404 con shape { code, message } y no se crea incidencia', async () => {
    const before = app.store.listIncidents().length;

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: crypto.randomUUID() },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: expect.any(String),
      message: expect.any(String),
    });
    expect(app.store.listIncidents()).toHaveLength(before);
  });

  // @AC-TELCO-007
  it('servicio CANCELLED → 409 SERVICE_CANCELLED y no se crea incidencia', async () => {
    const contract = await seed.contract(app, { status: 'CANCELLED' });
    const before = app.store.listIncidents().length;

    const res = await app.inject({
      method: 'POST',
      url: '/incidents',
      payload: { contractId: contract.id },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'SERVICE_CANCELLED' });
    expect(app.store.listIncidents()).toHaveLength(before);
  });
});
