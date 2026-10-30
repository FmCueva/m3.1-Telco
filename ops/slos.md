# SLOs — Sistema TELCO (derivados de la spec, Módulo Operación vídeo 2)

> Regla: si lo especificas, lo mides; si lo mides, lo alertas.

## SLO-1 · Latencia de consulta (de NFR-PERF-001)

**99 % de las peticiones `GET /customers/:id` y `GET /contracts/:id` responden 2xx en < 200 ms (ventana 28 d rolling).**

SLI (good events / valid events):

```promql
sum(rate(http_request_duration_seconds_bucket{route=~"/customers/:id|/contracts/:id", le="0.2", code=~"2.."}[28d]))
/
sum(rate(http_request_duration_seconds_count{route=~"/customers/:id|/contracts/:id", code!~"4.."}[28d]))
```

## SLO-2 · Disponibilidad de incidencias (de NFR-DISP-001)

**99,5 % de las peticiones `POST /incidents` devuelven código != 5xx (ventana 28 d rolling).**

SLI:

```promql
sum(rate(http_requests_total{route="/incidents", method="POST", code!~"5..", code!~"4.."}[28d]))
/
sum(rate(http_requests_total{route="/incidents", method="POST", code!~"4.."}[28d]))
```

Error budget a 5 req/s de media: 5 × 86 400 × 28 × 0,005 ≈ **60 480 peticiones/mes**
(≈ 201,6 min de caída total equivalente).

## SLO-3 · Tiempo de resolución de la cola MANUAL_REVIEW (de NFR-OPS-001)

**95 % de las incidencias que entran en `MANUAL_REVIEW` se resuelve en menos de 4 horas (ventana 28 d rolling).**

Umbral decidido por el humano: 4 h cabe en un turno de soporte; 2 h exigiría guardia continua y 8 h deja
al cliente esperando un día. El 95 % deja un margen de 1 de cada 20 para casos complejos.

SLI (good events / valid events). Un evento es una incidencia de la cola ya resuelta; `le="14400"` es el
límite de 4 h del histograma `incident_manual_review_resolution_seconds`:

```promql
sum(increase(incident_manual_review_resolution_seconds_bucket{le="14400"}[28d]))
/
sum(increase(incident_manual_review_resolution_seconds_count[28d]))
```

Error budget: el 5 % de las incidencias resueltas puede tardar más de 4 h. Con 100 incidencias al mes en
la cola, son 5 resoluciones lentas.

Limitación conocida: el SLI solo cuenta incidencias ya resueltas. Una que nunca se resuelve no entra; la
cubre la alerta `IncidentManualQueueSaturated` (cola > 50) y su runbook.

## Política de error budget (resumen)

🟢 >50 % restante: ritmo normal · 🟡 10-50 %: revisión semanal ·
🔴 <10 %: feature freeze, foco en fiabilidad · ⚫ 0 %: post-mortem + decisión del instructor.
Excepción: PRs `safety-fix` con approval del on-call.

## Métricas del módulo IA (NFR-AI-001, NFR-AUDIT-001)

| Métrica | Umbral de alerta |
|---|---|
| `ai_cost_per_incident_eur` (histograma) | p95 > 0,01 € |
| `ai_confidence` (histograma) | p50 < 0,6 durante 1 h (drift del modelo) |
| `ai_acceptance_rate` (aceptadas/total) | < 50 % semanal → revisar prompt |
| `audit_log_completeness` | < 99,9 % → alerta crítica (INV-6) |
