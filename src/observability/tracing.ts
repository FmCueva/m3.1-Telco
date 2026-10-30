// src/observability/tracing.ts — trazas OpenTelemetry → collector (OTLP/HTTP) → Jaeger.
// Debe importarse ANTES que fastify/http para que la instrumentación los parchee (server.ts, 1.ª línea).
// Sin OTEL_EXPORTER_OTLP_ENDPOINT no hace nada: tests y demo local arrancan sin collector.
// Hoja del ADR-001: no importa otros módulos. Nunca se añaden atributos con PII.

import { trace, type Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const SERVICE_NAME = 'telco-api';

let provider: NodeTracerProvider | undefined;

export function startTracing(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || provider) return false;
  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': SERVICE_NAME }),
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })),
    ],
  });
  provider.register();
  registerInstrumentations({
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
  });
  return true;
}

export async function stopTracing(): Promise<void> {
  await provider?.shutdown();
  provider = undefined;
}

// Span propio para el paso de IA: se ve en la traza de POST /incidents (JOB-007).
export function tracer(): Tracer {
  return trace.getTracer(SERVICE_NAME);
}
