// src/domain/incidentRules.ts — estado de la incidencia tras la clasificación (INV-5, FR-DOM-014).
// Dominio puro: sin IO. Una sugerencia válida NO se aplica sola: espera la decisión del técnico (INV-6).

import type { Incident, IncidentStatus } from './types';

export function statusAfterClassification(
  outcome: 'suggestion' | 'manual_review',
): IncidentStatus {
  return outcome === 'manual_review' ? 'MANUAL_REVIEW' : 'OPEN';
}

export class IncidentAlreadyResolvedError extends Error {
  readonly code = 'INCIDENT_ALREADY_RESOLVED';
  constructor() {
    super('La incidencia ya está resuelta');
    this.name = 'IncidentAlreadyResolvedError';
  }
}

// INV-10: RESOLVED es terminal. Solo registra quién y cuándo; no aplica sugerencias (INV-6).
export function resolveIncident(
  incident: Incident,
  technicianId: string,
  resolvedAt: string,
): Incident {
  if (incident.status === 'RESOLVED') throw new IncidentAlreadyResolvedError();
  return { ...incident, status: 'RESOLVED', resolvedBy: technicianId, resolvedAt };
}
