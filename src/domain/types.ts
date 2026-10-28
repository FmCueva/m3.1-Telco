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
