// tests/unit/incidentRules.test.ts — estado de la incidencia tras clasificar (INV-5, FR-DOM-014).

import { describe, expect, it } from 'vitest';
import {
  IncidentAlreadyResolvedError,
  resolveIncident,
  statusAfterClassification,
} from '../../src/domain/incidentRules';
import type { Incident } from '../../src/domain/types';

describe('statusAfterClassification', () => {
  // @AC-TELCO-004
  it('manual_review → MANUAL_REVIEW', () => {
    expect(statusAfterClassification('manual_review')).toBe('MANUAL_REVIEW');
  });

  it('sugerencia válida → OPEN (pendiente del técnico, no se aplica sola)', () => {
    expect(statusAfterClassification('suggestion')).toBe('OPEN');
  });
});

describe('resolveIncident (INV-10, FR-DOM-017)', () => {
  const base: Incident = {
    id: 'i-1',
    contractId: 'c-1',
    description: 'Sin servicio',
    status: 'OPEN',
  };
  const at = '2026-10-29T10:00:00.000Z';

  // @AC-TELCO-009
  it.each(['OPEN', 'MANUAL_REVIEW'] as const)(
    '%s → RESOLVED con técnico y marca de tiempo',
    (status) => {
      const resolved = resolveIncident({ ...base, status }, 't-17', at);
      expect(resolved).toMatchObject({
        status: 'RESOLVED',
        resolvedBy: 't-17',
        resolvedAt: at,
      });
    },
  );

  // @AC-TELCO-009
  it('no muta la incidencia de entrada', () => {
    const input = { ...base };
    resolveIncident(input, 't-17', at);
    expect(input).toEqual(base);
  });

  // @AC-TELCO-010
  it('RESOLVED es terminal → IncidentAlreadyResolvedError', () => {
    const resolved: Incident = { ...base, status: 'RESOLVED' };
    expect(() => resolveIncident(resolved, 't-17', at)).toThrow(
      IncidentAlreadyResolvedError,
    );
  });
});
