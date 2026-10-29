// tests/unit/classifyIncident.test.ts — clasificador con el SDK mockeado (0 tokens).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyIncident,
  computeCostEur,
  COST_METRIC,
} from '../../src/ai/classifyIncident';
import type { MessagesClient } from '../../src/ai/classifyIncident';
import { getMetricSamples, resetMetrics } from '../../src/observability/metrics';

const USAGE = { input_tokens: 800, output_tokens: 150 };

function mockClient(text: string): {
  client: MessagesClient;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text }],
    usage: USAGE,
  });
  return { client: { messages: { create } } as unknown as MessagesClient, create };
}

const json = (o: unknown): string => JSON.stringify(o);

beforeEach(() => resetMetrics());

describe('classifyIncident', () => {
  // @AC-TELCO-004
  it('confianza alta y esquema válido → sugerencia (pendiente de técnico)', async () => {
    const { client, create } = mockClient(
      json({
        category: 'NO_SERVICE',
        confidence: 0.92,
        suggestedResolution: 'Reiniciar ONT.',
      }),
    );
    const r = await classifyIncident('Sin internet desde ayer', client);
    expect(r.kind).toBe('suggestion');
    if (r.kind === 'suggestion') expect(r.suggestion.category).toBe('NO_SERVICE');
    expect(create.mock.calls[0]?.[0].model).toBe('claude-haiku-4-5');
    expect(create.mock.calls[0]?.[0].system).toContain('técnico humano');
  });

  // @AC-TELCO-004
  it('confidence 0.55 → manual_review', async () => {
    const { client } = mockClient(
      json({
        category: 'BILLING',
        confidence: 0.55,
        suggestedResolution: 'Revisar factura.',
      }),
    );
    const r = await classifyIncident('Cobro raro', client);
    expect(r).toMatchObject({ kind: 'manual_review', reason: 'low_confidence' });
  });

  it('JSON malformado → manual_review sin lanzar excepción', async () => {
    const { client } = mockClient('{no es json');
    await expect(classifyIncident('x', client)).resolves.toMatchObject({
      kind: 'manual_review',
      reason: 'invalid_output',
    });
  });

  it('categoría fuera del enum → manual_review', async () => {
    const { client } = mockClient(
      json({ category: 'ALIENS', confidence: 0.99, suggestedResolution: 'n/a' }),
    );
    const r = await classifyIncident('x', client);
    expect(r).toMatchObject({ kind: 'manual_review', reason: 'invalid_output' });
  });

  it('suggestedResolution > 600 caracteres → manual_review', async () => {
    const { client } = mockClient(
      json({
        category: 'OTHER',
        confidence: 0.9,
        suggestedResolution: 'a'.repeat(601),
      }),
    );
    expect((await classifyIncident('x', client)).kind).toBe('manual_review');
  });

  it('error del proveedor → manual_review, no excepción', async () => {
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error('503')) },
    } as unknown as MessagesClient;
    await expect(classifyIncident('x', client)).resolves.toMatchObject({
      kind: 'manual_review',
      reason: 'ai_error',
    });
  });

  it('calcula el coste con usage y lo registra en ai_cost_per_incident_eur', async () => {
    const { client } = mockClient(
      json({
        category: 'SLOW_SPEED',
        confidence: 0.85,
        suggestedResolution: 'Medir velocidad.',
      }),
    );
    const r = await classifyIncident('Lento', client);
    const expected = (800 * 0.92 + 150 * 4.6) / 1_000_000;
    expect(computeCostEur(USAGE)).toBeCloseTo(expected, 10);
    expect(r.costEur).toBeCloseTo(expected, 10);
    expect(getMetricSamples(COST_METRIC)).toEqual([r.costEur]);
    expect(r.costEur).toBeLessThan(0.01);
  });
});
