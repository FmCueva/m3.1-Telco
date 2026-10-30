// tests/unit/logging-no-pii.test.ts — INV-7 / NFR-AUDIT-001: cero PII en logs.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyIncident } from '../../src/ai/classifyIncident';
import type { MessagesClient } from '../../src/ai/classifyIncident';
import { logEvent, resetLogSink, setLogSink } from '../../src/observability/logger';
import { resetMetrics } from '../../src/observability/metrics';

afterEach(() => {
  resetLogSink();
  resetMetrics();
});

describe('logger sin PII', () => {
  it.each(['name', 'phone', 'documento', 'email', 'description'])(
    'campo prohibido %s → lanza error',
    (key) => {
      expect(() => logEvent('x', { [key]: 'valor' })).toThrow(/prohibido/);
    },
  );

  it.each(['juan@example.com', '+34 600 123 456', '1712345678'])(
    'valor con forma de PII (%s) → lanza error',
    (value) => {
      expect(() => logEvent('x', { ref: value })).toThrow(/PII/);
    },
  );

  it('un UUID con segmentos numéricos no es PII', () => {
    expect(() =>
      logEvent('x', { incident_id: '12345678-1234-4567-8123-45678123456a' }),
    ).not.toThrow();
  });

  it('identificadores opacos pasan', () => {
    const lines: string[] = [];
    setLogSink((l) => lines.push(l));
    logEvent('x', { customer_id: 'c-721' });
    expect(lines[0]).toContain('c-721');
  });

  it('el flujo del clasificador no deja PII en los logs aunque la descripción la contenga', async () => {
    const lines: string[] = [];
    setLogSink((l) => lines.push(l));
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            category: 'BILLING',
            confidence: 0.9,
            suggestedResolution: 'Revisar factura.',
          }),
        },
      ],
      usage: { input_tokens: 800, output_tokens: 150 },
    });
    const client = { messages: { create } } as unknown as MessagesClient;

    await classifyIncident(
      'Soy Juan Pérez, mi teléfono es 600123456 y mi correo juan@example.com',
      client,
    );

    expect(lines.length).toBeGreaterThan(0);
    const all = lines.join('\n');
    expect(all).not.toMatch(/Juan|Pérez|600123456|juan@example\.com/);
  });
});
