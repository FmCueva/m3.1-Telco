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
import {
  assertNotDecided,
  SuggestionAlreadyDecidedError,
} from '../domain/suggestionRules';
import { InvalidTransitionError, transition } from '../domain/serviceTransitions';
import { statusAfterClassification } from '../domain/incidentRules';
import type { Customer, Incident, ServiceContract } from '../domain/types';
import { logEvent } from '../observability/logger';
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
const decisionBody = z.object({
  technicianId: z.string().min(1),
  decision: z.enum(['ACCEPTED', 'MODIFIED', 'REJECTED']),
});
const createIncidentBody = z.object({
  contractId: z.string().min(1),
  description: z.string().min(1),
});
const listIncidentsQuery = z.object({
  status: z.enum(['OPEN', 'MANUAL_REVIEW', 'RESOLVED']).optional(),
});

// Contrato mínimo del clasificador (estructural: la API no importa src/ai, ADR-001).
// server.ts inyecta classifyIncident; sin clasificador la incidencia queda en OPEN.
export type ClassifierOutcome =
  | {
      kind: 'suggestion';
      suggestion: { category: string; confidence: number; suggestedResolution: string };
      model: string;
    }
  | { kind: 'manual_review'; reason: string; model: string };
export type IncidentClassifier = (description: string) => Promise<ClassifierOutcome>;
export interface BuildAppOptions {
  logger?: boolean;
  classifier?: IncidentClassifier;
}

type IdParams = { id: string };

// Errores de dominio → HTTP. Shape uniforme { code, message }.
function domainStatus(error: unknown): number | undefined {
  if (error instanceof InvalidTransitionError) return 409; // INV-2, INV-3
  if (error instanceof KycRequiredError) return 403; // INV-4
  if (error instanceof DebtOutstandingError) return 409; // INV-8
  if (error instanceof ServiceCancelledError) return 409; // INV-9
  if (error instanceof SuggestionAlreadyDecidedError) return 409; // INV-6
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

// Guarda la sugerencia y la audita (INV-6, NFR-AUDIT-001): solo IDs opacos, nunca la descripción.
function storeSuggestion(
  app: FastifyInstance,
  incidentId: string,
  outcome: Extract<ClassifierOutcome, { kind: 'suggestion' }>,
) {
  const suggestion = app.store.putSuggestion({
    id: crypto.randomUUID(),
    incidentId,
    ...outcome.suggestion,
    model: outcome.model,
  });
  logEvent('suggestion_created', {
    suggestion_id: suggestion.id,
    incident_id: incidentId,
    model: suggestion.model,
    category: suggestion.category,
    confidence: suggestion.confidence,
  });
  return {
    suggestionId: suggestion.id,
    category: suggestion.category,
    confidence: suggestion.confidence,
    suggestedResolution: suggestion.suggestedResolution,
  };
}

function registerIncidentRoutes(
  app: FastifyInstance,
  classify?: IncidentClassifier,
): void {
  app.post('/incidents', async (request, reply) => {
    const { contractId, description } = createIncidentBody.parse(request.body);
    const contract = app.store.getContract(contractId);
    if (!contract)
      return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Servicio no existe'));
    assertCanOpenIncident(contract);
    const outcome = classify ? await classify(description) : undefined;
    const incident: Incident = {
      id: crypto.randomUUID(),
      contractId,
      description,
      status: outcome ? statusAfterClassification(outcome.kind) : 'OPEN',
    };
    app.store.putIncident(incident);
    if (outcome?.kind !== 'suggestion') return reply.status(201).send(incident);

    return reply.status(201).send({
      ...incident,
      suggestion: storeSuggestion(app, incident.id, outcome),
    });
  });

  // Cola de revisión manual: GET /incidents?status=MANUAL_REVIEW
  app.get('/incidents', async (request) => {
    const { status } = listIncidentsQuery.parse(request.query);
    return app.store.listIncidents().filter((i) => !status || i.status === status);
  });

  app.post<{ Params: IdParams }>('/incidents/:id/resolve', async (request, reply) => {
    const incident = app.store.getIncident(request.params.id);
    if (!incident)
      return reply.status(404).send(err('INCIDENT_NOT_FOUND', 'Incidencia no existe'));
    return app.store.putIncident({ ...incident, status: 'RESOLVED' });
  });
}

function registerSuggestionRoutes(app: FastifyInstance): void {
  app.post<{ Params: IdParams }>(
    '/suggestions/:id/decision',
    async (request, reply) => {
      const { technicianId, decision } = decisionBody.parse(request.body);
      const suggestion = app.store.getSuggestion(request.params.id);
      if (!suggestion)
        return reply
          .status(404)
          .send(err('SUGGESTION_NOT_FOUND', 'Sugerencia no existe'));
      assertNotDecided(app.store.getDecision(suggestion.id));
      const record = app.store.putDecision({
        suggestionId: suggestion.id,
        technicianId,
        decision,
        decidedAt: new Date().toISOString(),
      });
      logEvent('suggestion_decision', {
        suggestion_id: record.suggestionId,
        technician_id: record.technicianId,
        decision: record.decision,
      });
      return reply.status(201).send(record);
    },
  );
}

export function buildApp({
  logger = false,
  classifier,
}: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger });
  app.decorate('store', new InMemoryStore());
  registerErrorHandling(app);
  app.get('/healthz', async () => ({ status: 'ok' }));
  registerCustomerRoutes(app);
  registerContractRoutes(app);
  registerIncidentRoutes(app, classifier);
  registerSuggestionRoutes(app);
  return app;
}
