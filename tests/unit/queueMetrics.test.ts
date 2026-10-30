// tests/unit/queueMetrics.test.ts — duración de resolución de la cola MANUAL_REVIEW (NFR-OPS-001).

import { describe, expect, it } from 'vitest';
import { manualReviewResolutionSeconds } from '../../src/domain/queueMetrics';
import type { Incident } from '../../src/domain/types';

const base: Incident = {
  id: 'i-1',
  contractId: 'c-1',
  description: 'x',
  status: 'OPEN',
};

describe('manualReviewResolutionSeconds', () => {
  // @AC-TELCO-013
  it('resuelta tras 5 h en MANUAL_REVIEW → 18 000 s', () => {
    const incident: Incident = {
      ...base,
      status: 'RESOLVED',
      manualReviewAt: '2026-10-29T08:00:00.000Z',
      resolvedAt: '2026-10-29T13:00:00.000Z',
    };
    expect(manualReviewResolutionSeconds([incident])).toEqual([18_000]);
  });

  // @AC-TELCO-014
  it('sin paso por MANUAL_REVIEW → no cuenta', () => {
    const incident: Incident = {
      ...base,
      status: 'RESOLVED',
      resolvedAt: '2026-10-29T13:00:00.000Z',
    };
    expect(manualReviewResolutionSeconds([incident])).toEqual([]);
  });

  // @AC-TELCO-013
  it('todavía en la cola (sin resolver) → no cuenta', () => {
    const incident: Incident = {
      ...base,
      status: 'MANUAL_REVIEW',
      manualReviewAt: '2026-10-29T08:00:00.000Z',
    };
    expect(manualReviewResolutionSeconds([incident])).toEqual([]);
  });
});
