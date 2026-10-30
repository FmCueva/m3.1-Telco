// src/observability/histogram.ts — histograma en formato texto de Prometheus (hoja del ADR-001).

export function histogramLines(
  name: string,
  help: string,
  bounds: readonly number[],
  values: readonly number[],
): string[] {
  const buckets = bounds.map(
    (le) => `${name}_bucket{le="${le}"} ${values.filter((v) => v <= le).length}`,
  );
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} histogram`,
    ...buckets,
    `${name}_bucket{le="+Inf"} ${values.length}`,
    `${name}_sum ${values.reduce((a, b) => a + b, 0)}`,
    `${name}_count ${values.length}`,
  ];
}
