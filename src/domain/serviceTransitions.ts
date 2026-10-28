// src/domain/serviceTransitions.ts — máquina de estados del servicio (ADR-002, INV-2, INV-3).
// Dominio puro: sin IO ni imports de framework, base de datos o HTTP.

import type { ServiceEvent, ServiceStatus } from './types';

type TransitionTable = Readonly<
  Record<ServiceStatus, Readonly<Partial<Record<ServiceEvent, ServiceStatus>>>>
>;

// Tabla de la spec 1.2, literal. CANCELLED es terminal (INV-3): no tiene ninguna salida.
export const VALID_TRANSITIONS: TransitionTable = Object.freeze({
  DRAFT: Object.freeze({
    confirm: 'PENDING_INSTALLATION',
    cancel: 'CANCELLED',
  }),
  PENDING_INSTALLATION: Object.freeze({
    installationCompleted: 'ACTIVE',
    cancel: 'CANCELLED',
  }),
  ACTIVE: Object.freeze({
    paymentDefault: 'SUSPENDED',
    cancel: 'CANCELLED',
  }),
  SUSPENDED: Object.freeze({
    paymentRegularized: 'ACTIVE',
    cancel: 'CANCELLED',
  }),
  CANCELLED: Object.freeze({}),
});

// La API la traduce a HTTP 409 sin modificar el estado (INV-2).
export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';

  constructor(
    readonly from: ServiceStatus,
    readonly event: ServiceEvent,
  ) {
    super(`Transición inválida: ${event} desde ${from}`);
    this.name = 'InvalidTransitionError';
  }
}

// Única función que cambia el estado del servicio. Pura: devuelve el estado nuevo.
export function transition(from: ServiceStatus, event: ServiceEvent): ServiceStatus {
  const to = VALID_TRANSITIONS[from][event];
  if (to === undefined) throw new InvalidTransitionError(from, event);
  return to;
}
