// src/domain/suggestionRules.ts — regla de la decisión del técnico (INV-6, AC-TELCO-005).
// Dominio puro: sin IO. La API traduce el `code` a HTTP.

import type { SuggestionDecisionRecord } from './types';

export class SuggestionAlreadyDecidedError extends Error {
  readonly code = 'SUGGESTION_ALREADY_DECIDED';
  constructor() {
    super('La sugerencia ya tiene una decisión del técnico');
    this.name = 'SuggestionAlreadyDecidedError';
  }
}

// La primera decisión es la auditada: no se sobrescribe.
export function assertNotDecided(existing: SuggestionDecisionRecord | undefined): void {
  if (existing) throw new SuggestionAlreadyDecidedError();
}
