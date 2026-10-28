// src/domain/contractRules.ts — reglas de contratación e incidencias (spec 2.1, INV-4; deuda e incidencia sobre CANCELLED pendientes de spec).
// Dominio puro: sin IO. La API traduce el `code` de cada error a HTTP.

import type { Customer, ServiceContract } from './types';

export class KycRequiredError extends Error {
  readonly code = 'KYC_REQUIRED';
  constructor() {
    super('El cliente no tiene el KYC verificado');
    this.name = 'KycRequiredError';
  }
}

export class DebtOutstandingError extends Error {
  readonly code = 'DEBT_OUTSTANDING';
  constructor() {
    super('El cliente tiene deuda pendiente');
    this.name = 'DebtOutstandingError';
  }
}

export class ServiceCancelledError extends Error {
  readonly code = 'SERVICE_CANCELLED';
  constructor() {
    super('El servicio está CANCELLED');
    this.name = 'ServiceCancelledError';
  }
}

export function assertCanContract(customer: Customer): void {
  if (customer.status !== 'VERIFIED') throw new KycRequiredError();
  if (customer.outstandingDebt > 0) throw new DebtOutstandingError();
}

export function assertCanOpenIncident(contract: ServiceContract): void {
  if (contract.status === 'CANCELLED') throw new ServiceCancelledError();
}
