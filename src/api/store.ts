// src/api/store.ts — "DB" en memoria: nace y muere con el proceso (demo y tests de contrato).
// Sin IO ni dependencias externas. Los métodos put* devuelven la entidad guardada.

import type {
  AuditEntry,
  Customer,
  Incident,
  ServiceContract,
  Suggestion,
  SuggestionDecisionRecord,
} from '../domain/types';

export class InMemoryStore {
  private readonly customers = new Map<string, Customer>();
  private readonly contracts = new Map<string, ServiceContract>();
  private readonly incidents = new Map<string, Incident>();
  private readonly suggestions = new Map<string, Suggestion>();
  private readonly decisions = new Map<string, SuggestionDecisionRecord>();
  private readonly auditLog: AuditEntry[] = [];

  getCustomer(id: string): Customer | undefined {
    return this.customers.get(id);
  }

  putCustomer(customer: Customer): Customer {
    this.customers.set(customer.id, customer);
    return customer;
  }

  getContract(id: string): ServiceContract | undefined {
    return this.contracts.get(id);
  }

  putContract(contract: ServiceContract): ServiceContract {
    this.contracts.set(contract.id, contract);
    return contract;
  }

  listContractsByCustomer(customerId: string): ServiceContract[] {
    return [...this.contracts.values()].filter((c) => c.customerId === customerId);
  }

  listIncidents(): Incident[] {
    return [...this.incidents.values()];
  }

  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  putIncident(incident: Incident): Incident {
    this.incidents.set(incident.id, incident);
    return incident;
  }

  getSuggestion(id: string): Suggestion | undefined {
    return this.suggestions.get(id);
  }

  putSuggestion(suggestion: Suggestion): Suggestion {
    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  getDecision(suggestionId: string): SuggestionDecisionRecord | undefined {
    return this.decisions.get(suggestionId);
  }

  putDecision(record: SuggestionDecisionRecord): SuggestionDecisionRecord {
    this.decisions.set(record.suggestionId, record);
    return record;
  }

  listSuggestions(): Suggestion[] {
    return [...this.suggestions.values()];
  }

  listDecisions(): SuggestionDecisionRecord[] {
    return [...this.decisions.values()];
  }

  appendAudit(entry: AuditEntry): void {
    this.auditLog.push(entry);
  }

  listAudit(): readonly AuditEntry[] {
    return this.auditLog;
  }
}
