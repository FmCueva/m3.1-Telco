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
import { acceptanceRate, auditLogCompleteness } from '../domain/auditMetrics';
import {
  IncidentAlreadyResolvedError,
  resolveIncident,
  statusAfterClassification,
} from '../domain/incidentRules';
import type { Customer, Incident, ServiceContract } from '../domain/types';
import { manualReviewResolutionSeconds } from '../domain/queueMetrics';
import { HttpMetrics } from '../observability/httpMetrics';
import { histogramLines } from '../observability/histogram';
import { registerWebhookRoutes } from './webhooks';
import { logEvent } from '../observability/logger';
import { InMemoryStore, type Store } from './store';

declare module 'fastify' {
  interface FastifyInstance {
    store: Store;
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
const resolveBody = z.object({ technicianId: z.string().min(1) });
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
  store?: Store; // por defecto, la DB en memoria; server.ts inyecta PostgreSQL si hay DATABASE_URL
  webhookSecret?: string; // sin secreto, todo webhook se rechaza con 401 (NFR-SEC-001)
}

type IdParams = { id: string };

// Errores de dominio → HTTP. Shape uniforme { code, message }.
function domainStatus(error: unknown): number | undefined {
  if (error instanceof InvalidTransitionError) return 409; // INV-2, INV-3
  if (error instanceof KycRequiredError) return 403; // INV-4
  if (error instanceof DebtOutstandingError) return 409; // INV-8
  if (error instanceof ServiceCancelledError) return 409; // INV-9
  if (error instanceof SuggestionAlreadyDecidedError) return 409; // INV-6
  if (error instanceof IncidentAlreadyResolvedError) return 409; // INV-10
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
    return reply.status(201).send(await app.store.putCustomer(customer));
  });

  app.post<{ Params: IdParams }>('/customers/:id/kyc', async (request, reply) => {
    const { result } = kycBody.parse(request.body);
    const customer = await app.store.getCustomer(request.params.id);
    if (!customer)
      return reply.status(404).send(err('CUSTOMER_NOT_FOUND', 'Cliente no existe'));
    return await app.store.putCustomer({ ...customer, status: result });
  });

  app.get<{ Params: IdParams }>('/customers/:id', async (request, reply) => {
    const customer = await app.store.getCustomer(request.params.id);
    if (!customer)
      return reply.status(404).send(err('CUSTOMER_NOT_FOUND', 'Cliente no existe'));
    return {
      ...customer,
      contracts: await app.store.listContractsByCustomer(customer.id),
    };
  });
}

function registerContractRoutes(app: FastifyInstance): void {
  app.post('/contracts', async (request, reply) => {
    const { customerId, type } = createContractBody.parse(request.body);
    const customer = await app.store.getCustomer(customerId);
    if (!customer)
      return reply.status(404).send(err('CUSTOMER_NOT_FOUND', 'Cliente no existe'));
    assertCanContract(customer);
    const contract: ServiceContract = {
      id: crypto.randomUUID(),
      customerId,
      type,
      status: 'DRAFT',
    };
    return reply.status(201).send(await app.store.putContract(contract));
  });

  app.get<{ Params: IdParams }>('/contracts/:id', async (request, reply) => {
    const contract = await app.store.getContract(request.params.id);
    if (!contract)
      return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Contrato no existe'));
    return contract;
  });

  app.post<{ Params: IdParams }>('/contracts/:id/events', async (request, reply) => {
    const { event } = eventBody.parse(request.body);
    const contract = await app.store.getContract(request.params.id);
    if (!contract)
      return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Contrato no existe'));
    const status = transition(contract.status, event); // lanza InvalidTransitionError → 409
    return await app.store.putContract({ ...contract, status });
  });
}

// Guarda la sugerencia y la audita (INV-6, NFR-AUDIT-001): solo IDs opacos, nunca la descripción.
async function storeSuggestion(
  app: FastifyInstance,
  incidentId: string,
  outcome: Extract<ClassifierOutcome, { kind: 'suggestion' }>,
) {
  const suggestion = await app.store.putSuggestion({
    id: crypto.randomUUID(),
    incidentId,
    ...outcome.suggestion,
    model: outcome.model,
  });
  await app.store.appendAudit({
    event: 'suggestion_created',
    suggestionId: suggestion.id,
    occurredAt: new Date().toISOString(),
    model: suggestion.model,
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
    const contract = await app.store.getContract(contractId);
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
    if (incident.status === 'MANUAL_REVIEW')
      incident.manualReviewAt = new Date().toISOString();
    await app.store.putIncident(incident);
    if (outcome?.kind !== 'suggestion') return reply.status(201).send(incident);

    return reply.status(201).send({
      ...incident,
      suggestion: await storeSuggestion(app, incident.id, outcome),
    });
  });

  // Cola de revisión manual: GET /incidents?status=MANUAL_REVIEW
  app.get('/incidents', async (request) => {
    const { status } = listIncidentsQuery.parse(request.query);
    return (await app.store.listIncidents()).filter(
      (i) => !status || i.status === status,
    );
  });
}

function registerIncidentResolutionRoutes(app: FastifyInstance): void {
  app.post<{ Params: IdParams }>('/incidents/:id/resolve', async (request, reply) => {
    const incident = await app.store.getIncident(request.params.id);
    if (!incident)
      return reply.status(404).send(err('INCIDENT_NOT_FOUND', 'Incidencia no existe'));
    const { technicianId } = resolveBody.parse(request.body);
    const resolved = await app.store.putIncident(
      resolveIncident(incident, technicianId, new Date().toISOString()),
    );
    await app.store.appendAudit({
      event: 'incident_resolved',
      incidentId: resolved.id,
      occurredAt: resolved.resolvedAt as string,
      technicianId,
    });
    logEvent('incident_resolved', {
      incident_id: resolved.id,
      technician_id: technicianId,
    });
    return resolved;
  });
}

function registerSuggestionRoutes(app: FastifyInstance): void {
  app.post<{ Params: IdParams }>(
    '/suggestions/:id/decision',
    async (request, reply) => {
      const { technicianId, decision } = decisionBody.parse(request.body);
      const suggestion = await app.store.getSuggestion(request.params.id);
      if (!suggestion)
        return reply
          .status(404)
          .send(err('SUGGESTION_NOT_FOUND', 'Sugerencia no existe'));
      assertNotDecided(await app.store.getDecision(suggestion.id));
      const record = await app.store.putDecision({
        suggestionId: suggestion.id,
        technicianId,
        decision,
        decidedAt: new Date().toISOString(),
      });
      await app.store.appendAudit({
        event: 'suggestion_decision',
        suggestionId: record.suggestionId,
        occurredAt: record.decidedAt,
        technicianId: record.technicianId,
        decision: record.decision,
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

// 14 400 s = 4 h: el umbral del SLO-3 (NFR-OPS-001) debe ser un límite de bucket.
const MANUAL_REVIEW_BUCKETS_SECONDS = [900, 3600, 14_400, 28_800, 86_400];

// Métricas AGREGADAS en formato texto de Prometheus (nunca por técnico: EU AI Act, Anexo III.4).
function registerMetricsRoute(app: FastifyInstance, http: HttpMetrics): void {
  app.get('/metrics', async (_request, reply) => {
    const decisions = await app.store.listDecisions();
    const incidents = await app.store.listIncidents();
    const rate = acceptanceRate(decisions);
    const completeness = auditLogCompleteness({
      suggestions: await app.store.listSuggestions(),
      decisions,
      audit: await app.store.listAudit(),
    });
    const lines = [
      '# HELP ai_acceptance_rate Decisiones ACCEPTED sobre el total de decisiones del técnico.',
      '# TYPE ai_acceptance_rate gauge',
      ...(rate === undefined ? [] : [`ai_acceptance_rate ${rate}`]),
      '# HELP ai_decisions_total Decisiones registradas sobre sugerencias de la IA.',
      '# TYPE ai_decisions_total counter',
      `ai_decisions_total ${decisions.length}`,
      '# HELP audit_log_completeness Entradas de auditoría completas sobre las esperadas (INV-6).',
      '# TYPE audit_log_completeness gauge',
      `audit_log_completeness ${completeness}`,
      '# HELP incidents_manual_review_queue_size Incidencias a la espera de un técnico (MANUAL_REVIEW).',
      '# TYPE incidents_manual_review_queue_size gauge',
      `incidents_manual_review_queue_size ${incidents.filter((i) => i.status === 'MANUAL_REVIEW').length}`,
      ...http.render(),
      ...histogramLines(
        'incident_manual_review_resolution_seconds',
        'Segundos desde la entrada en MANUAL_REVIEW hasta la resolución (NFR-OPS-001).',
        MANUAL_REVIEW_BUCKETS_SECONDS,
        manualReviewResolutionSeconds(incidents),
      ),
    ];
    return reply.type('text/plain; version=0.0.4').send(lines.join('\n') + '\n');
  });
}

// Mide cada respuesta por plantilla de ruta (nunca la URL real, que lleva ids). /metrics no se mide.
function registerHttpMetrics(app: FastifyInstance): HttpMetrics {
  const http = new HttpMetrics();
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';
    if (route === '/metrics') return;
    http.record(route, request.method, reply.statusCode, reply.elapsedTime / 1000);
  });
  return http;
}

export function buildApp({
  logger = false,
  classifier,
  webhookSecret,
  store = new InMemoryStore(),
}: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger });
  app.decorate('store', store);
  registerErrorHandling(app);
  const http = registerHttpMetrics(app);
  app.get('/healthz', async () => ({ status: 'ok' }));
  registerCustomerRoutes(app);
  registerContractRoutes(app);
  registerIncidentRoutes(app, classifier);
  registerIncidentResolutionRoutes(app);
  registerSuggestionRoutes(app);
  registerWebhookRoutes(app, webhookSecret);
  registerMetricsRoute(app, http);
  return app;
}
