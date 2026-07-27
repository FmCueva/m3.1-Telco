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

## Política de error budget (resumen)

🟢 >50 % restante: ritmo normal · 🟡 10-50 %: revisión semanal ·
🔴 <10 %: feature freeze, foco en fiabilidad · ⚫ 0 %: post-mortem + decisión del instructor.
Excepción: PRs `safety-fix` con approval del on-call.

## Métricas del módulo IA (NFR-COST-001, NFR-AUDIT-001)

| Métrica | Umbral de alerta |
|---|---|
| `ai_cost_per_incident_eur` (histograma) | p95 > 0,01 € |
| `ai_confidence` (histograma) | p50 < 0,6 durante 1 h (drift del modelo) |
| `ai_acceptance_rate` (aceptadas/total) | < 50 % semanal → revisar prompt |
| `audit_log_completeness` | < 99,9 % → alerta crítica (INV-6) |
