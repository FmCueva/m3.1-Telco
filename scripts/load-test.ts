// scripts/load-test.ts — NFR-PERF-001 hecho gate (Módulo Operación, vídeo 6):
// "si lo especificas, lo mides". GET /customers/:id y GET /contracts/:id deben
// sostener p95 < 200 ms a 100 req/s. Lo invoca .github/workflows/nightly-load.yml.
// Uso: BASE_URL=http://localhost:8080 npx tsx scripts/load-test.ts [duracion_seg]
// P95_BUDGET_MS solo se sobreescribe para probar que el gate FALLA en local;
// el umbral real es el del NFR.

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const RPS = 100; // carga declarada en el NFR
const DURATION_S = Number(process.argv[2] ?? 30);
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS ?? 200); // umbral declarado en el NFR

async function seed(): Promise<string[]> {
  // Mismo camino feliz de los contract tests: cliente → KYC → contrato.
  const customer = (await (
    await fetch(`${BASE}/customers`, { method: 'POST' })
  ).json()) as {
    id: string;
  };
  await fetch(`${BASE}/customers/${customer.id}/kyc`, { method: 'POST' });
  const contract = (await (
    await fetch(`${BASE}/contracts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customerId: customer.id, type: 'FIBER' }),
    })
  ).json()) as { id: string };
  return [`/customers/${customer.id}`, `/contracts/${contract.id}`]; // las 2 rutas del SLO-1
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

async function main() {
  const targets = await seed();
  const latencies: number[] = [];
  let errors = 0;

  for (let second = 0; second < DURATION_S; second++) {
    const tick = Date.now();
    const batch = Array.from({ length: RPS }, (_, i) => {
      const url = `${BASE}${targets[i % targets.length]}`;
      const t0 = performance.now();
      return fetch(url)
        .then((res) => {
          if (res.ok) latencies.push(performance.now() - t0);
          else errors++;
        })
        .catch(() => {
          errors++;
        });
    });
    await Promise.all(batch);
    const left = 1000 - (Date.now() - tick);
    if (left > 0) await new Promise((r) => setTimeout(r, left)); // ritmo: 100 req cada segundo
  }

  const observed = p95(latencies);
  console.log(
    `${latencies.length} peticiones · ${errors} errores · p95 ${observed.toFixed(1)} ms (umbral ${P95_BUDGET_MS} ms)`,
  );
  process.exit(observed < P95_BUDGET_MS && errors === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
