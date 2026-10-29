// tests/unit/auditMetrics.test.ts — ai_acceptance_rate y audit_log_completeness (INV-6, NFR-AUDIT-001).

import { describe, expect, it } from 'vitest';
import { acceptanceRate, auditLogCompleteness } from '../../src/domain/auditMetrics';
import type {
  AuditEntry,
  Suggestion,
  SuggestionDecisionRecord,
} from '../../src/domain/types';

const decision = (
  suggestionId: string,
  d: SuggestionDecisionRecord['decision'],
): SuggestionDecisionRecord => ({
  suggestionId,
  technicianId: 't-17',
  decision: d,
  decidedAt: '2026-10-29T10:00:00.000Z',
});

const suggestion = (id: string): Suggestion => ({
  id,
  incidentId: `i-${id}`,
  category: 'OTHER',
  confidence: 0.9,
  suggestedResolution: 'Revisar.',
  model: 'claude-haiku-4-5',
});

const created = (id: string, data: Partial<AuditEntry> = {}): AuditEntry => ({
  event: 'suggestion_created',
  suggestionId: id,
  occurredAt: '2026-10-29T10:00:00.000Z',
  model: 'claude-haiku-4-5',
  ...data,
});

const decided = (id: string, data: Partial<AuditEntry> = {}): AuditEntry => ({
  event: 'suggestion_decision',
  suggestionId: id,
  occurredAt: '2026-10-29T10:05:00.000Z',
  technicianId: 't-17',
  decision: 'ACCEPTED',
  ...data,
});

describe('acceptanceRate', () => {
  it('sin decisiones → undefined (no hay tasa que reportar)', () => {
    expect(acceptanceRate([])).toBeUndefined();
  });

  it('ACCEPTED sobre el total; MODIFIED y REJECTED no cuentan como aceptadas', () => {
    const rate = acceptanceRate([
      decision('a', 'ACCEPTED'),
      decision('b', 'MODIFIED'),
      decision('c', 'REJECTED'),
      decision('d', 'ACCEPTED'),
    ]);
    expect(rate).toBe(0.5);
  });
});

describe('auditLogCompleteness', () => {
  it('sin nada que auditar → 1', () => {
    expect(auditLogCompleteness({ suggestions: [], decisions: [], audit: [] })).toBe(1);
  });

  it('cada sugerencia y cada decisión con su entrada completa → 1', () => {
    const result = auditLogCompleteness({
      suggestions: [suggestion('a')],
      decisions: [decision('a', 'ACCEPTED')],
      audit: [created('a'), decided('a')],
    });
    expect(result).toBe(1);
  });

  it('sugerencia sin entrada de auditoría → fracción por debajo de 1', () => {
    const result = auditLogCompleteness({
      suggestions: [suggestion('a'), suggestion('b')],
      decisions: [],
      audit: [created('a')],
    });
    expect(result).toBe(0.5);
  });

  it('decisión sin entrada de auditoría → incompleta', () => {
    const result = auditLogCompleteness({
      suggestions: [suggestion('a')],
      decisions: [decision('a', 'REJECTED')],
      audit: [created('a')],
    });
    expect(result).toBe(0.5);
  });

  it('entrada sin modelo, sin técnico o sin marca de tiempo → no cuenta como completa', () => {
    const result = auditLogCompleteness({
      suggestions: [suggestion('a')],
      decisions: [decision('a', 'ACCEPTED')],
      audit: [
        created('a', { model: undefined }),
        decided('a', { technicianId: undefined }),
      ],
    });
    expect(result).toBe(0);
  });
});
