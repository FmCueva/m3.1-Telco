// scripts/coverage-gate.ts — el umbral de cobertura es un gate ejecutable, no una opinión.
// Uso: npx tsx scripts/coverage-gate.ts 80   (lo invocan ci.yml y scripts/check-dod.ts)
// Requiere el reporter json-summary de vitest: ejecutar antes `npm test` (vitest --coverage).

import { existsSync, readFileSync } from 'node:fs';

const threshold = Number(process.argv[2] ?? 80);
const summaryPath = 'coverage/coverage-summary.json';

if (!existsSync(summaryPath)) {
  console.error(
    `✗ no existe ${summaryPath}: ejecuta primero npm test (vitest run --coverage)`,
  );
  process.exit(1);
}

const { total } = JSON.parse(readFileSync(summaryPath, 'utf8'));
// Se exige el mínimo de líneas y sentencias: el más estricto de los dos manda.
const pct = Math.min(total.lines.pct, total.statements.pct);

console.log(`cobertura ${pct}% (umbral ${threshold}%)`);
process.exit(pct < threshold ? 1 : 0);
