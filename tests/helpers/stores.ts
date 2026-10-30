// tests/helpers/stores.ts — backends de persistencia para los tests parametrizados.
// La DB en memoria siempre corre; PostgreSQL solo si hay DATABASE_URL (job contract de CI).

import { Pool } from 'pg';
import { PgStore } from '../../src/api/pgStore';
import { InMemoryStore, type Store } from '../../src/api/store';

export interface Backend {
  name: string;
  open(): Promise<{ store: Store; dispose(): Promise<void> }>;
}

export const TABLES =
  'audit_log, suggestion_decisions, ai_suggestions, incidents, contracts, customers';

export const hasPostgres = Boolean(process.env.DATABASE_URL);

export const backends: Backend[] = [
  {
    name: 'memoria',
    open: async () => ({ store: new InMemoryStore(), dispose: async () => {} }),
  },
  ...(process.env.DATABASE_URL
    ? [
        {
          name: 'postgres',
          open: async () => {
            const url = process.env.DATABASE_URL as string;
            const pool = new Pool({ connectionString: url });
            await pool.query(`TRUNCATE ${TABLES}`); // cada test parte de una DB vacía
            await pool.end();
            const store = new PgStore(url);
            return { store, dispose: () => store.close() };
          },
        },
      ]
    : []),
];
