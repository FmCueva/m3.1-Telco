// src/api/pgStore.ts — persistencia en PostgreSQL (esquema en migrations/001_init.sql).
// Cumple el mismo contrato Store que la DB en memoria; la API no sabe cuál usa.
// Solo identificadores opacos: nunca se guardan nombre, teléfono ni documento (INV-7).

import { Pool } from 'pg';
import type {
  AuditEntry,
  Customer,
  Incident,
  ServiceContract,
  Suggestion,
  SuggestionDecisionRecord,
} from '../domain/types';
import type { Store } from './store';

type Row = Record<string, unknown>;

const iso = (v: unknown): string | undefined =>
  v === null || v === undefined
    ? undefined
    : new Date(v as string | Date).toISOString();

const toCustomer = (r: Row): Customer => ({
  id: r.id as string,
  status: r.kyc_status as Customer['status'],
  outstandingDebt: Number(r.outstanding_debt),
});
const toContract = (r: Row): ServiceContract => ({
  id: r.id as string,
  customerId: r.customer_id as string,
  type: r.type as ServiceContract['type'],
  status: r.status as ServiceContract['status'],
});
const toIncident = (r: Row): Incident => ({
  id: r.id as string,
  contractId: r.contract_id as string,
  description: r.description as string,
  status: r.status as Incident['status'],
  ...(r.manual_review_at ? { manualReviewAt: iso(r.manual_review_at) } : {}),
  ...(r.resolved_by ? { resolvedBy: r.resolved_by as string } : {}),
  ...(r.resolved_at ? { resolvedAt: iso(r.resolved_at) } : {}),
});
const toSuggestion = (r: Row): Suggestion => ({
  id: r.id as string,
  incidentId: r.incident_id as string,
  category: r.category as string,
  confidence: Number(r.confidence),
  suggestedResolution: r.suggested_resolution as string,
  model: r.model as string,
});
const toDecision = (r: Row): SuggestionDecisionRecord => ({
  suggestionId: r.suggestion_id as string,
  technicianId: r.technician_id as string,
  decision: r.decision as SuggestionDecisionRecord['decision'],
  decidedAt: iso(r.decided_at) as string,
});
const toAudit = (r: Row): AuditEntry => ({
  event: r.event as AuditEntry['event'],
  occurredAt: iso(r.occurred_at) as string,
  ...(r.suggestion_id ? { suggestionId: r.suggestion_id as string } : {}),
  ...(r.incident_id ? { incidentId: r.incident_id as string } : {}),
  ...(r.technician_id ? { technicianId: r.technician_id as string } : {}),
  ...(r.decision ? { decision: r.decision as AuditEntry['decision'] } : {}),
  ...(r.model ? { model: r.model as string } : {}),
});

export class PgStore implements Store {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async one<T>(sql: string, params: unknown[], map: (r: Row) => T) {
    const { rows } = await this.pool.query(sql, params);
    return rows[0] ? map(rows[0] as Row) : undefined;
  }

  private async many<T>(sql: string, params: unknown[], map: (r: Row) => T) {
    const { rows } = await this.pool.query(sql, params);
    return (rows as Row[]).map(map);
  }

  getCustomer(id: string) {
    return this.one('SELECT * FROM customers WHERE id = $1', [id], toCustomer);
  }

  async putCustomer(c: Customer) {
    await this.pool.query(
      `INSERT INTO customers (id, kyc_status, outstanding_debt) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET kyc_status = $2, outstanding_debt = $3`,
      [c.id, c.status, c.outstandingDebt],
    );
    return c;
  }

  getContract(id: string) {
    return this.one('SELECT * FROM contracts WHERE id = $1', [id], toContract);
  }

  async putContract(c: ServiceContract) {
    await this.pool.query(
      `INSERT INTO contracts (id, customer_id, type, status) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET customer_id = $2, type = $3, status = $4`,
      [c.id, c.customerId, c.type, c.status],
    );
    return c;
  }

  listContractsByCustomer(customerId: string) {
    return this.many(
      'SELECT * FROM contracts WHERE customer_id = $1',
      [customerId],
      toContract,
    );
  }

  listIncidents() {
    return this.many('SELECT * FROM incidents', [], toIncident);
  }

  getIncident(id: string) {
    return this.one('SELECT * FROM incidents WHERE id = $1', [id], toIncident);
  }

  async putIncident(i: Incident) {
    await this.pool.query(
      `INSERT INTO incidents
         (id, contract_id, description, status, manual_review_at, resolved_by, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET status = $4, manual_review_at = $5,
         resolved_by = $6, resolved_at = $7`,
      [
        i.id,
        i.contractId,
        i.description,
        i.status,
        i.manualReviewAt ?? null,
        i.resolvedBy ?? null,
        i.resolvedAt ?? null,
      ],
    );
    return i;
  }

  getSuggestion(id: string) {
    return this.one('SELECT * FROM ai_suggestions WHERE id = $1', [id], toSuggestion);
  }

  async putSuggestion(s: Suggestion) {
    await this.pool.query(
      `INSERT INTO ai_suggestions
         (id, incident_id, category, confidence, suggested_resolution, model)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.incidentId, s.category, s.confidence, s.suggestedResolution, s.model],
    );
    return s;
  }

  getDecision(suggestionId: string) {
    return this.one(
      'SELECT * FROM suggestion_decisions WHERE suggestion_id = $1',
      [suggestionId],
      toDecision,
    );
  }

  async putDecision(d: SuggestionDecisionRecord) {
    // INV-6: la primera decisión es la auditada; no se sobrescribe.
    await this.pool.query(
      `INSERT INTO suggestion_decisions (suggestion_id, technician_id, decision, decided_at)
       VALUES ($1, $2, $3, $4) ON CONFLICT (suggestion_id) DO NOTHING`,
      [d.suggestionId, d.technicianId, d.decision, d.decidedAt],
    );
    return d;
  }

  listSuggestions() {
    return this.many('SELECT * FROM ai_suggestions', [], toSuggestion);
  }

  listDecisions() {
    return this.many('SELECT * FROM suggestion_decisions', [], toDecision);
  }

  async appendAudit(e: AuditEntry) {
    await this.pool.query(
      `INSERT INTO audit_log
         (event, suggestion_id, incident_id, technician_id, decision, model, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        e.event,
        e.suggestionId ?? null,
        e.incidentId ?? null,
        e.technicianId ?? null,
        e.decision ?? null,
        e.model ?? null,
        e.occurredAt,
      ],
    );
  }

  async listAudit() {
    return this.many('SELECT * FROM audit_log ORDER BY id', [], toAudit);
  }
}
