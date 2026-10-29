// INV-1 el estado es un union type cerrado. Los booleanos están prohibidos aquí

export type ServiceStatus =
  | 'DRAFT'
  | 'PENDING_INSTALLATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED';

export type ServiceEvent =
  | 'confirm'
  | 'installationCompleted'
  | 'paymentDefault'
  | 'paymentRegularized'
  | 'cancel';

// Entidades que persiste el store. Solo datos: las reglas viven en el dominio.
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Customer {
  id: string;
  status: KycStatus;
  outstandingDebt: number;
}

export type ContractType = 'FIBER' | 'MOBILE' | 'PACK';

export interface ServiceContract {
  id: string;
  customerId: string;
  type: ContractType;
  status: ServiceStatus;
}

export type IncidentStatus = 'OPEN' | 'MANUAL_REVIEW' | 'RESOLVED';

export interface Incident {
  id: string;
  contractId: string;
  description: string;
  status: IncidentStatus;
}

// INV-6: la IA solo sugiere; la decisión es siempre de un técnico humano y queda registrada.
export type SuggestionDecision = 'ACCEPTED' | 'MODIFIED' | 'REJECTED';

export interface Suggestion {
  id: string;
  incidentId: string;
  category: string;
  confidence: number;
  suggestedResolution: string;
  model: string;
}

export interface SuggestionDecisionRecord {
  suggestionId: string;
  technicianId: string; // identificador opaco (t-17), nunca el nombre
  decision: SuggestionDecision;
  decidedAt: string; // ISO 8601
}

// Registro de auditoría (NFR-AUDIT-001): una entrada por sugerencia y una por decisión.
export interface AuditEntry {
  event: 'suggestion_created' | 'suggestion_decision';
  suggestionId: string;
  occurredAt: string; // ISO 8601
  model?: string; // suggestion_created
  technicianId?: string; // suggestion_decision, opaco
  decision?: SuggestionDecision; // suggestion_decision
}
