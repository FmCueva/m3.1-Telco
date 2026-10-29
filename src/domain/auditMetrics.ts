// src/domain/auditMetrics.ts — métricas de supervisión humana (INV-6, NFR-AUDIT-001).
// Dominio puro: sin IO. Son métricas AGREGADAS: nunca se calculan por técnico.

import type { AuditEntry, Suggestion, SuggestionDecisionRecord } from './types';

// ai_acceptance_rate: decisiones ACCEPTED / total. Sin decisiones no hay tasa.
export function acceptanceRate(
  decisions: readonly SuggestionDecisionRecord[],
): number | undefined {
  if (decisions.length === 0) return undefined;
  return decisions.filter((d) => d.decision === 'ACCEPTED').length / decisions.length;
}

function isComplete(entry: AuditEntry | undefined): boolean {
  if (!entry || !entry.suggestionId || !entry.occurredAt) return false;
  if (entry.event === 'suggestion_created') return Boolean(entry.model);
  return Boolean(entry.technicianId && entry.decision);
}

// audit_log_completeness: entradas de auditoría completas / entradas esperadas.
// Se espera una por sugerencia (suggestion_created) y una por decisión (suggestion_decision).
export function auditLogCompleteness(input: {
  suggestions: readonly Suggestion[];
  decisions: readonly SuggestionDecisionRecord[];
  audit: readonly AuditEntry[];
}): number {
  const expected = input.suggestions.length + input.decisions.length;
  if (expected === 0) return 1;
  const find = (event: AuditEntry['event'], id: string) =>
    input.audit.find((e) => e.event === event && e.suggestionId === id);
  const complete =
    input.suggestions.filter((s) => isComplete(find('suggestion_created', s.id)))
      .length +
    input.decisions.filter((d) =>
      isComplete(find('suggestion_decision', d.suggestionId)),
    ).length;
  return complete / expected;
}
