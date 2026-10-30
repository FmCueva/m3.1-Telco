// src/api/store.ts — contrato de persistencia y "DB" en memoria: nace y muere con el proceso
// (demo y tests de contrato). Sin IO ni dependencias externas. Los put* devuelven la entidad guardada.

import type {
  AuditEntry,
  Customer,
  Incident,
  ServiceContract,
  Suggestion,
  SuggestionDecisionRecord,
} from '../domain/types';

// Contrato de persistencia: lo cumplen la DB en memoria (tests, demo) y PostgreSQL (pgStore.ts).
export interface Store {
  getCustomer(id: string): Promise<Customer | undefined>;
  putCustomer(customer: Customer): Promise<Customer>;
  getContract(id: string): Promise<ServiceContract | undefined>;
  putContract(contract: ServiceContract): Promise<ServiceContract>;
  listContractsByCustomer(customerId: string): Promise<ServiceContract[]>;
  listIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  putIncident(incident: Incident): Promise<Incident>;
  getSuggestion(id: string): Promise<Suggestion | undefined>;
  putSuggestion(suggestion: Suggestion): Promise<Suggestion>;
  getDecision(suggestionId: string): Promise<SuggestionDecisionRecord | undefined>;
  putDecision(record: SuggestionDecisionRecord): Promise<SuggestionDecisionRecord>;
  listSuggestions(): Promise<Suggestion[]>;
  listDecisions(): Promise<SuggestionDecisionRecord[]>;
  appendAudit(entry: AuditEntry): Promise<void>;
  listAudit(): Promise<readonly AuditEntry[]>;
}

export class InMemoryStore implements Store {
  private readonly customers = new Map<string, Customer>();
  private readonly contracts = new Map<string, ServiceContract>();
  private readonly incidents = new Map<string, Incident>();
  private readonly suggestions = new Map<string, Suggestion>();
  private readonly decisions = new Map<string, SuggestionDecisionRecord>();
  private readonly auditLog: AuditEntry[] = [];

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async putCustomer(customer: Customer): Promise<Customer> {
    this.customers.set(customer.id, customer);
    return customer;
  }

  async getContract(id: string): Promise<ServiceContract | undefined> {
    return this.contracts.get(id);
  }

  async putContract(contract: ServiceContract): Promise<ServiceContract> {
    this.contracts.set(contract.id, contract);
    return contract;
  }

  async listContractsByCustomer(customerId: string): Promise<ServiceContract[]> {
    return [...this.contracts.values()].filter((c) => c.customerId === customerId);
  }

  async listIncidents(): Promise<Incident[]> {
    return [...this.incidents.values()];
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    return this.incidents.get(id);
  }

  async putIncident(incident: Incident): Promise<Incident> {
    this.incidents.set(incident.id, incident);
    return incident;
  }

  async getSuggestion(id: string): Promise<Suggestion | undefined> {
    return this.suggestions.get(id);
  }

  async putSuggestion(suggestion: Suggestion): Promise<Suggestion> {
    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  async getDecision(
    suggestionId: string,
  ): Promise<SuggestionDecisionRecord | undefined> {
    return this.decisions.get(suggestionId);
  }

  async putDecision(
    record: SuggestionDecisionRecord,
  ): Promise<SuggestionDecisionRecord> {
    this.decisions.set(record.suggestionId, record);
    return record;
  }

  async listSuggestions(): Promise<Suggestion[]> {
    return [...this.suggestions.values()];
  }

  async listDecisions(): Promise<SuggestionDecisionRecord[]> {
    return [...this.decisions.values()];
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    this.auditLog.push(entry);
  }

  async listAudit(): Promise<readonly AuditEntry[]> {
    return this.auditLog;
  }
}
