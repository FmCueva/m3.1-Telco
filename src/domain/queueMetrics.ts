// src/domain/queueMetrics.ts — tiempo de resolución de la cola MANUAL_REVIEW (NFR-OPS-001).
// Dominio puro: sin IO. Son duraciones AGREGADAS: no llevan identificador de técnico.

import type { Incident } from './types';

// Segundos entre la entrada en MANUAL_REVIEW y la resolución, solo de las incidencias que
// pasaron por la cola y ya se resolvieron.
export function manualReviewResolutionSeconds(
  incidents: readonly Incident[],
): number[] {
  return incidents.flatMap((i) => {
    if (!i.manualReviewAt || !i.resolvedAt) return [];
    return [(Date.parse(i.resolvedAt) - Date.parse(i.manualReviewAt)) / 1000];
  });
}
