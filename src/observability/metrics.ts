// src/observability/metrics.ts — métricas en memoria (hoja del ADR-001: no importa otros módulos).
// ai_cost_per_incident_eur (NFR-AI-001): histograma simplificado, una muestra por clasificación.

const samples = new Map<string, number[]>();

export function recordMetric(name: string, value: number): void {
  const list = samples.get(name) ?? [];
  list.push(value);
  samples.set(name, list);
}

export function getMetricSamples(name: string): readonly number[] {
  return samples.get(name) ?? [];
}

export function resetMetrics(): void {
  samples.clear();
}
