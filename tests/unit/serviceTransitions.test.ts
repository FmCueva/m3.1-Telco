// tests/unit/serviceTransitions.test.ts — INV-2 e INV-3 (specs/spec-servicio.md, secciones 1.2 y 1.3).
// Estados y eventos siguen los valores de src/domain/types.ts (union types del proyecto).
// La tabla se repite aquí A PROPÓSITO: no importa VALID_TRANSITIONS, así el test defiende
// el invariante de forma independiente a la implementación (TDD, paso 1: rojo).

import { describe, expect, it } from 'vitest';
import type { ServiceEvent, ServiceStatus } from '../../src/domain/types';
import { InvalidTransitionError, transition } from '../../src/domain/serviceTransitions';

const STATES: readonly ServiceStatus[] = [
  'DRAFT',
  'PENDING_INSTALLATION',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
];

const EVENTS: readonly ServiceEvent[] = [
  'confirm',
  'installationCompleted',
  'paymentDefault',
  'paymentRegularized',
  'cancel',
];

// Spec 1.2: las 8 transiciones válidas (desde, evento, hacia).
const VALID: ReadonlyArray<readonly [ServiceStatus, ServiceEvent, ServiceStatus]> = [
  ['DRAFT', 'confirm', 'PENDING_INSTALLATION'],
  ['DRAFT', 'cancel', 'CANCELLED'],
  ['PENDING_INSTALLATION', 'installationCompleted', 'ACTIVE'], // @AC-TELCO-001
  ['PENDING_INSTALLATION', 'cancel', 'CANCELLED'],
  ['ACTIVE', 'paymentDefault', 'SUSPENDED'],
  ['ACTIVE', 'cancel', 'CANCELLED'],
  ['SUSPENDED', 'paymentRegularized', 'ACTIVE'],
  ['SUSPENDED', 'cancel', 'CANCELLED'],
];

const isValid = (from: ServiceStatus, event: ServiceEvent): boolean =>
  VALID.some(([f, e]) => f === from && e === event);

// Spec 1.3: las 17 combinaciones restantes de las 25 (estado × evento), generadas con bucles.
const INVALID: Array<[ServiceStatus, ServiceEvent]> = [];
for (const from of STATES) {
  for (const event of EVENTS) {
    if (!isValid(from, event)) INVALID.push([from, event]);
  }
}

describe('transition() — transiciones válidas (spec 1.2)', () => {
  it('la tabla de la spec tiene exactamente 8 transiciones', () => {
    expect(VALID).toHaveLength(8);
  });

  it.each(VALID)('%s + %s -> %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to);
  });
});

describe('transition() — INV-2: toda combinación fuera de la tabla es inválida', () => {
  it('estado × evento son 25 combinaciones: 8 válidas y 17 inválidas', () => {
    expect(STATES.length * EVENTS.length).toBe(25);
    expect(INVALID).toHaveLength(17);
  });

  it.each(INVALID)('%s + %s lanza InvalidTransitionError', (from, event) => {
    expect(() => transition(from, event)).toThrow(InvalidTransitionError);
  });

  it.each(INVALID)('%s + %s lanza con código INVALID_TRANSITION', (from, event) => {
    expect(() => transition(from, event)).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });
});

describe('transition() — INV-3: CANCELLED es terminal @AC-TELCO-002', () => {
  it.each(EVENTS)('CANCELLED + %s lanza InvalidTransitionError', (event) => {
    expect(() => transition('CANCELLED', event)).toThrow(InvalidTransitionError);
  });
});
