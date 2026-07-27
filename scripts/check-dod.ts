// scripts/check-dod.ts
// La DoD no es un párrafo en Confluence: es código (Módulo Construcción, vídeo 1).
// Uso: npx tsx scripts/check-dod.ts JOB-004

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

// Acepta: "JOB-004" a secas, un título completo "feat: JOB-004 ..." (aunque el shell
// lo trocee en varios argv), o la env PR_TITLE que inyecta ci.yml.
const source = process.env.PR_TITLE || process.argv.slice(2).join(' ');
const jobId = source.match(/JOB-\d{3}/)?.[0];
if (!jobId) {
  console.error('Uso: check-dod.ts <JOB-xxx>  (o un título de PR que lo contenga)');
  process.exit(2);
}

const plan = parse(readFileSync('plan/jobs.yaml', 'utf8'));
const job = plan.jobs.find((j: { id: string }) => j.id === jobId);
if (!job) {
  console.error(`✗ ${jobId} no existe en plan/jobs.yaml`);
  process.exit(2);
}

// Trazabilidad: si un trabajo no traza a un requisito, no debería existir.
const srs = readFileSync('specs/srs-telco.md', 'utf8');
const checks: Array<{ name: string; run: () => boolean }> = [
  {
    name: 'todo requirement del JOB existe en el SRS',
    run: () => (job.requirements ?? []).every((r: string) => srs.includes(r)),
  },
  {
    name: 'spec validada presente',
    run: () => existsSync('specs/spec-servicio.md'),
  },
  {
    name: 'tests unitarios verdes',
    run: () => run('npm run test:unit -- --run'),
  },
  {
    name: 'tests de contrato verdes',
    run: () => run('npm run test:contract -- --run'),
  },
  {
    name: 'cobertura ≥ 80 %',
    run: () => run('npx tsx scripts/coverage-gate.ts 80'),
  },
];

let ok = true;
for (const c of checks) {
  const passed = c.run();
  console.log(`${passed ? '✓' : '✗'} ${c.name}`);
  ok &&= passed;
}
process.exit(ok ? 0 : 1);

function run(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
