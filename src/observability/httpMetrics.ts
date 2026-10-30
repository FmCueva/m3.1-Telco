// src/observability/httpMetrics.ts — métricas HTTP por ruta (alimentan SLO-1 y SLO-2 de ops/slos.md).
// Hoja del ADR-001: no importa otros módulos. Una instancia por app; etiquetas de baja cardinalidad
// (plantilla de ruta, método, código), nunca ids ni PII.

export const DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2.5,
];

interface RouteStat {
  route: string;
  method: string;
  code: number;
  count: number;
  sum: number;
  buckets: number[];
}

export class HttpMetrics {
  private readonly stats = new Map<string, RouteStat>();

  record(route: string, method: string, code: number, seconds: number): void {
    const key = `${route}|${method}|${code}`;
    const stat = this.stats.get(key) ?? {
      route,
      method,
      code,
      count: 0,
      sum: 0,
      buckets: DURATION_BUCKETS_SECONDS.map(() => 0),
    };
    stat.count += 1;
    stat.sum += seconds;
    DURATION_BUCKETS_SECONDS.forEach((le, i) => {
      if (seconds <= le) stat.buckets[i] += 1;
    });
    this.stats.set(key, stat);
  }

  render(): string[] {
    const all = [...this.stats.values()];
    const lines = [
      '# HELP http_requests_total Peticiones HTTP por ruta, método y código.',
      '# TYPE http_requests_total counter',
      ...all.map(
        (s) =>
          `http_requests_total{route="${s.route}",method="${s.method}",code="${s.code}"} ${s.count}`,
      ),
      '# HELP http_request_duration_seconds Latencia de las peticiones HTTP por ruta.',
      '# TYPE http_request_duration_seconds histogram',
    ];
    // La duración se agrega por (ruta, código): el método no cambia el SLI de latencia.
    const byRoute = new Map<string, RouteStat>();
    for (const s of all) {
      const key = `${s.route}|${s.code}`;
      const agg = byRoute.get(key) ?? {
        ...s,
        count: 0,
        sum: 0,
        buckets: s.buckets.map(() => 0),
      };
      agg.count += s.count;
      agg.sum += s.sum;
      s.buckets.forEach((n, i) => (agg.buckets[i] += n));
      byRoute.set(key, agg);
    }
    for (const s of byRoute.values()) {
      const labels = `route="${s.route}",code="${s.code}"`;
      DURATION_BUCKETS_SECONDS.forEach((le, i) =>
        lines.push(
          `http_request_duration_seconds_bucket{${labels},le="${le}"} ${s.buckets[i]}`,
        ),
      );
      lines.push(
        `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${s.count}`,
        `http_request_duration_seconds_sum{${labels}} ${s.sum}`,
        `http_request_duration_seconds_count{${labels}} ${s.count}`,
      );
    }
    return lines;
  }
}
