// tests/helpers/testApp.ts — helpers de los tests de contrato.
// La "DB efímera" es el store en memoria: nace en buildTestApp() y muere con
// app.close(). seed escribe DIRECTO en app.store (no vía API): es la única
// forma de sembrar estados que el API no permite crear, como un contrato
// CANCELLED.

import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from '../../src/api/app';
import type { Customer, ServiceContract, Suggestion } from '../../src/domain/types';

export async function buildTestApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = buildApp(options); // store en memoria nuevo: cada suite arranca limpia
  await app.ready();
  return app;
}

export const seed = {
  async customer(
    app: FastifyInstance,
    data: Partial<Customer> = {},
  ): Promise<Customer> {
    const customer: Customer = {
      id: crypto.randomUUID(),
      status: 'VERIFIED',
      outstandingDebt: 0,
      ...data,
    };
    return app.store.putCustomer(customer);
  },

  async contract(
    app: FastifyInstance,
    data: Partial<ServiceContract> = {},
  ): Promise<ServiceContract> {
    // Todo contrato pertenece a un cliente: si no llega, se siembra uno VERIFIED.
    const customerId = data.customerId ?? (await seed.customer(app)).id;
    const contract: ServiceContract = {
      id: crypto.randomUUID(),
      type: 'FIBER',
      status: 'DRAFT',
      ...data,
      customerId,
    };
    return app.store.putContract(contract);
  },

  async suggestion(
    app: FastifyInstance,
    data: Partial<Suggestion> = {},
  ): Promise<Suggestion> {
    return app.store.putSuggestion({
      id: crypto.randomUUID(),
      incidentId: crypto.randomUUID(),
      category: 'OTHER',
      confidence: 0.9,
      suggestedResolution: 'Revisar.',
      model: 'claude-haiku-4-5',
      ...data,
    });
  },
};
