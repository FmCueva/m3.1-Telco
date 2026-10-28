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
  status: IncidentStatus;
}
