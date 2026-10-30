// tests/unit/contractRules.test.ts — reglas de contratación e incidencias (INV-4, INV-8, INV-9).

import { describe, expect, it } from 'vitest';
import {
  assertCanContract,
  assertCanOpenIncident,
  DebtOutstandingError,
  KycRequiredError,
  ServiceCancelledError,
} from '../../src/domain/contractRules';
import type { Customer, ServiceContract } from '../../src/domain/types';

const customer = (data: Partial<Customer> = {}): Customer => ({
  id: 'c-721',
  status: 'VERIFIED',
  outstandingDebt: 0,
  ...data,
});

const contract = (status: ServiceContract['status']): ServiceContract => ({
  id: 's-1',
  customerId: 'c-721',
  type: 'FIBER',
  status,
});

describe('assertCanContract', () => {
  // @AC-TELCO-003
  it.each(['PENDING', 'REJECTED'] as const)('KYC %s → KycRequiredError', (status) => {
    expect(() => assertCanContract(customer({ status }))).toThrow(KycRequiredError);
  });

  // @AC-TELCO-006
  it('deuda > 0 → DebtOutstandingError', () => {
    expect(() => assertCanContract(customer({ outstandingDebt: 0.01 }))).toThrow(
      DebtOutstandingError,
    );
  });

  // @AC-TELCO-003
  it('KYC VERIFIED y sin deuda → permitido', () => {
    expect(() => assertCanContract(customer())).not.toThrow();
  });
});

describe('assertCanOpenIncident', () => {
  // @AC-TELCO-007
  it('servicio CANCELLED → ServiceCancelledError', () => {
    expect(() => assertCanOpenIncident(contract('CANCELLED'))).toThrow(
      ServiceCancelledError,
    );
  });

  // @AC-TELCO-007
  it.each(['DRAFT', 'PENDING_INSTALLATION', 'ACTIVE', 'SUSPENDED'] as const)(
    'servicio %s → permitido',
    (status) => {
      expect(() => assertCanOpenIncident(contract(status))).not.toThrow();
    },
  );
});
