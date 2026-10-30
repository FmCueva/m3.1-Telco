// tests/contract/store.persistence.test.ts — el mismo contrato de persistencia en memoria y en PostgreSQL.

import { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import type { Store } from '../../src/api/store';
import { backends, hasPostgres, TABLES } from '../helpers/stores';

describe.each(backends)('persistencia ($name)', (backend) => {
  let dispose: (() => Promise<void>) | undefined;
  let store: Store;

  const open = async () => {
    const opened = await backend.open();
    store = opened.store;
    dispose = opened.dispose;
  };
  afterEach(async () => dispose?.());

  async function seedIncident(
    status: 'OPEN' | 'MANUAL_REVIEW',
    manualReviewAt?: string,
  ) {
    await store.putCustomer({ id: 'c-1', status: 'VERIFIED', outstandingDebt: 0 });
    await store.putContract({
      id: 'k-1',
      customerId: 'c-1',
      type: 'FIBER',
      status: 'ACTIVE',
    });
    return store.putIncident({
      id: 'i-1',
      contractId: 'k-1',
      description: 'Sin internet',
      status,
      ...(manualReviewAt ? { manualReviewAt } : {}),
    });
  }

  // @AC-TELCO-003
  it('cliente: KYC y deuda sobreviven al guardado', async () => {
    await open();
    await store.putCustomer({ id: 'c-1', status: 'PENDING', outstandingDebt: 12.5 });
    await store.putCustomer({ id: 'c-1', status: 'VERIFIED', outstandingDebt: 12.5 });

    expect(await store.getCustomer('c-1')).toEqual({
      id: 'c-1',
      status: 'VERIFIED',
      outstandingDebt: 12.5,
    });
    expect(await store.getCustomer('nope')).toBeUndefined();
  });

  // @AC-TELCO-002
  it('contrato: el estado CANCELLED se persiste y se lista por cliente', async () => {
    await open();
    await store.putCustomer({ id: 'c-1', status: 'VERIFIED', outstandingDebt: 0 });
    await store.putContract({
      id: 'k-1',
      customerId: 'c-1',
      type: 'PACK',
      status: 'ACTIVE',
    });
    await store.putContract({
      id: 'k-1',
      customerId: 'c-1',
      type: 'PACK',
      status: 'CANCELLED',
    });

    expect((await store.getContract('k-1'))?.status).toBe('CANCELLED');
    expect(await store.listContractsByCustomer('c-1')).toHaveLength(1);
  });

  // @AC-TELCO-009 @AC-TELCO-013
  it('incidencia: manualReviewAt, resolvedBy y resolvedAt hacen ida y vuelta', async () => {
    await open();
    const at = '2026-10-29T08:00:00.000Z';
    const resolvedAt = '2026-10-29T13:00:00.000Z';
    await seedIncident('MANUAL_REVIEW', at);
    await store.putIncident({
      id: 'i-1',
      contractId: 'k-1',
      description: 'Sin internet',
      status: 'RESOLVED',
      manualReviewAt: at,
      resolvedBy: 't-17',
      resolvedAt,
    });

    expect(await store.getIncident('i-1')).toMatchObject({
      status: 'RESOLVED',
      manualReviewAt: at,
      resolvedBy: 't-17',
      resolvedAt,
    });
    expect(await store.listIncidents()).toHaveLength(1);
  });

  // @AC-TELCO-005
  it('sugerencia, decisión y auditoría en orden', async () => {
    await open();
    await seedIncident('OPEN');
    await store.putSuggestion({
      id: 's-1',
      incidentId: 'i-1',
      category: 'BILLING',
      confidence: 0.92,
      suggestedResolution: 'Revisar.',
      model: 'claude-haiku-4-5',
    });
    const decision = {
      suggestionId: 's-1',
      technicianId: 't-17',
      decision: 'ACCEPTED' as const,
      decidedAt: '2026-10-29T10:00:00.000Z',
    };
    await store.putDecision(decision);
    await store.appendAudit({
      event: 'suggestion_created',
      suggestionId: 's-1',
      occurredAt: '2026-10-29T09:00:00.000Z',
      model: 'claude-haiku-4-5',
    });
    await store.appendAudit({
      event: 'suggestion_decision',
      suggestionId: 's-1',
      occurredAt: decision.decidedAt,
      technicianId: 't-17',
      decision: 'ACCEPTED',
    });

    expect((await store.getSuggestion('s-1'))?.confidence).toBe(0.92);
    expect(await store.getDecision('s-1')).toEqual(decision);
    expect((await store.listAudit()).map((a) => a.event)).toEqual([
      'suggestion_created',
      'suggestion_decision',
    ]);
  });
});

// INV-1 también en la base de datos: un estado fuera del conjunto cerrado no se puede guardar.
describe.skipIf(!hasPostgres)('esquema PostgreSQL', () => {
  // @AC-TELCO-002
  it('rechaza un estado de servicio fuera del tipo cerrado (INV-1)', async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`TRUNCATE ${TABLES}`);
    await pool.query("INSERT INTO customers (id) VALUES ('c-1')");

    await expect(
      pool.query(
        "INSERT INTO contracts (id, customer_id, type, status) VALUES ('k-1','c-1','FIBER','ACTIVO')",
      ),
    ).rejects.toThrow(/check/i);
    await pool.end();
  });
});
