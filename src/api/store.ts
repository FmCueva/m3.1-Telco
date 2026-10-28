// src/api/store.ts — "DB" en memoria: nace y muere con el proceso (demo y tests de contrato).
// Sin IO ni dependencias externas. Los métodos put* devuelven la entidad guardada.

import type { Customer, Incident, ServiceContract } from '../domain/types';

export class InMemoryStore {
  private readonly customers = new Map<string, Customer>();
  private readonly contracts = new Map<string, ServiceContract>();
  private readonly incidents = new Map<string, Incident>();

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

  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  putIncident(incident: Incident): Incident {
    this.incidents.set(incident.id, incident);
    return incident;
  }
}
