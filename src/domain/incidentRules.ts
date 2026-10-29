// src/domain/incidentRules.ts — estado de la incidencia tras la clasificación (INV-5, FR-DOM-014).
// Dominio puro: sin IO. Una sugerencia válida NO se aplica sola: espera la decisión del técnico (INV-6).

import type { IncidentStatus } from './types';

export function statusAfterClassification(
  outcome: 'suggestion' | 'manual_review',
): IncidentStatus {
  return outcome === 'manual_review' ? 'MANUAL_REVIEW' : 'OPEN';
}
