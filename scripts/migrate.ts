// scripts/migrate.ts — aplica migrations/*.sql en orden alfabético, dentro de una transacción.
// Lo ejecuta SOLO el job contract de CI (npm run migrate, con su Postgres de servicio):
// los tests locales usan persistencia en memoria y nunca tocan una DB real.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '✗ falta DATABASE_URL (ej: postgres://postgres:test@localhost:5432/postgres)',
    );
    process.exit(1);
  }

  const files = readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // Todo o nada: una migración a medias deja la DB peor que no migrar.
    await client.query('BEGIN');
    for (const file of files) {
      await client.query(readFileSync(join('migrations', file), 'utf8'));
      console.log(`✓ ${file}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
