// src/api/app.ts — capa HTTP delgada: parsea, llama al dominio/store y traduce a HTTP.
// Sin reglas de negocio aquí. No importa src/ai (frontera ADR-001): arranca sin API key.

import Fastify, { type FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import {
  assertCanContract,
  assertCanOpenIncident,
  DebtOutstandingError,
  KycRequiredError,
  ServiceCancelledError,
} from '../domain/contractRules';
import { InvalidTransitionError, transition } from '../domain/serviceTransitions';
import type { Customer, Incident, ServiceContract } from '../domain/types';
import { InMemoryStore } from './store';

declare module 'fastify' {
  interface FastifyInstance {
    store: InMemoryStore;
  }
}

const createContractBody = z.object({
  customerId: z.string().min(1),
  type: z.enum(['FIBER', 'MOBILE', 'PACK']),
});
const eventBody = z.object({
  event: z.enum([
    'confirm',
    'installationCompleted',
    'paymentDefault',
    'paymentRegularized',
    'cancel',
  ]),
});
const kycBody = z.object({ result: z.enum(['VERIFIED', 'REJECTED']) });
const createIncidentBody = z.object({ contractId: z.string().min(1) });

type IdParams = { id: string };

// Errores de dominio → HTTP. Shape uniforme { code, message }.
function domainStatus(error: unknown): number | undefined {
  if (error instanceof InvalidTransitionError) return 409; // INV-2, INV-3
  if (error instanceof KycRequiredError) return 403; // INV-4
  if (error instanceof DebtOutstandingError) return 409; // INV-8
  if (error instanceof ServiceCancelledError) return 409; // INV-9
  return undefined;
}

const err = (code: string, message: string) => ({ code, message });

function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send(err('VALIDATION_ERROR', error.message));
    }
    const status = domainStatus(error);
    if (status !== undefined) {
      const { code, message } = error as Error & { code: string };
      return reply.status(status).send(err(code, message));
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send(err('BAD_REQUEST', 'Solicitud inválida'));
    }
    app.log.error(error);
    return reply.status(500).send(err('INTERNAL_ERROR', 'Error interno'));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(err('NOT_FOUND', 'Ruta no encontrada')),
  );
}

function registerCustomerRoutes(app: FastifyInstance): void {
  app.post('/customers', async (_request, reply) => {
    const customer: Customer = {
      id: crypto.randomUUID(),
      status: 'PENDING',
      outstandingDebt: 0,
    };
    return reply.status(201).send(app.store.putCustomer(customer));
  });

  app.post<{ Params: IdParams }>('/customers/:id/kyc', async (request, reply) => {
    const { result } = kycBody.parse(request.body);
    const customer = app.store.getCustomer(request.params.id);
    if (!customer)
      return reply.status(404).send(err('CUSTOMER_NOT_FOUND', 'Cliente no existe'));
    return app.store.putCustomer({ ...customer, status: result });
  });

  app.get<{ Params: IdParams }>('/customers/:id', async (request, reply) => {
    const customer = app.store.getCustomer(request.params.id);
    if (!customer)
      return reply.status(404).send(err('CUSTOMER_NOT_FOUND', 'Cliente no existe'));
    return { ...customer, contracts: app.store.listContractsByCustomer(customer.id) };
  });
}

function registerContractRoutes(app: FastifyInstance): void {
  app.post('/contracts', async (request, reply) => {
    const { customerId, type } = createContractBody.parse(request.body);
    const customer = app.store.getCustomer(customerId);
    if (!customer)
      return reply.status(404).send(err('CUSTOMER_NOT_FOUND', 'Cliente no existe'));
    assertCanContract(customer);
    const contract: ServiceContract = {
      id: crypto.randomUUID(),
      customerId,
      type,
      status: 'DRAFT',
    };
    return reply.status(201).send(app.store.putContract(contract));
  });

  app.get<{ Params: IdParams }>('/contracts/:id', async (request, reply) => {
    const contract = app.store.getContract(request.params.id);
    if (!contract)
      return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Contrato no existe'));
    return contract;
  });

  app.post<{ Params: IdParams }>('/contracts/:id/events', async (request, reply) => {
    const { event } = eventBody.parse(request.body);
    const contract = app.store.getContract(request.params.id);
    if (!contract)
      return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Contrato no existe'));
    const status = transition(contract.status, event); // lanza InvalidTransitionError → 409
    return app.store.putContract({ ...contract, status });
  });
}

function registerIncidentRoutes(app: FastifyInstance): void {
  app.post('/incidents', async (request, reply) => {
    const { contractId } = createIncidentBody.parse(request.body);
    const contract = app.store.getContract(contractId);
    if (!contract)
      return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Servicio no existe'));
    assertCanOpenIncident(contract);
    const incident: Incident = { id: crypto.randomUUID(), contractId, status: 'OPEN' };
    return reply.status(201).send(app.store.putIncident(incident));
  });

  app.post<{ Params: IdParams }>('/incidents/:id/resolve', async (request, reply) => {
    const incident = app.store.getIncident(request.params.id);
    if (!incident)
      return reply.status(404).send(err('INCIDENT_NOT_FOUND', 'Incidencia no existe'));
    return app.store.putIncident({ ...incident, status: 'RESOLVED' });
  });
}

export function buildApp({
  logger = false,
}: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger });
  app.decorate('store', new InMemoryStore());
  registerErrorHandling(app);
  app.get('/healthz', async () => ({ status: 'ok' }));
  registerCustomerRoutes(app);
  registerContractRoutes(app);
  registerIncidentRoutes(app);
  return app;
}
