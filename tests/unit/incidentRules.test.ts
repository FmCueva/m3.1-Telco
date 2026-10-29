// tests/unit/incidentRules.test.ts — estado de la incidencia tras clasificar (INV-5, FR-DOM-014).

import { describe, expect, it } from 'vitest';
import { statusAfterClassification } from '../../src/domain/incidentRules';

describe('statusAfterClassification', () => {
  // @AC-TELCO-004
  it('manual_review → MANUAL_REVIEW', () => {
    expect(statusAfterClassification('manual_review')).toBe('MANUAL_REVIEW');
  });

  it('sugerencia válida → OPEN (pendiente del técnico, no se aplica sola)', () => {
    expect(statusAfterClassification('suggestion')).toBe('OPEN');
  });
});
