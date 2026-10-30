// tests/unit/suggestionRules.test.ts — la decisión del técnico es única por sugerencia (INV-6).

import { describe, expect, it } from 'vitest';
import {
  assertNotDecided,
  SuggestionAlreadyDecidedError,
} from '../../src/domain/suggestionRules';
import type { SuggestionDecisionRecord } from '../../src/domain/types';

const record: SuggestionDecisionRecord = {
  suggestionId: 'sg-1',
  technicianId: 't-17',
  decision: 'ACCEPTED',
  decidedAt: '2026-10-28T10:00:00.000Z',
};

describe('assertNotDecided', () => {
  // @AC-TELCO-005
  it('sin decisión previa → no lanza', () => {
    expect(() => assertNotDecided(undefined)).not.toThrow();
  });

  // @AC-TELCO-005
  it('con decisión previa → SuggestionAlreadyDecidedError', () => {
    expect(() => assertNotDecided(record)).toThrow(SuggestionAlreadyDecidedError);
  });
});
