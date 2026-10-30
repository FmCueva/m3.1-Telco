# Presupuesto operativo — una página (Módulo Operación, vídeo 6, Demo 2)

> Restricción del SRS (§5): coste total de operación **< 300 €/mes** a carga nominal.
> Regla de la demo del módulo: una sola hoja, y cada cifra se defiende, no se decora.

Carga nominal: ~5 req/s de media en `POST /incidents` (12 M eventos/mes contando
sistemas y reintentos), ~10 000 incidencias creadas/mes.

| Partida | Dimensionamiento defendido | €/mes |
|---|---|---:|
| Compute API (2 contenedores 1 vCPU / 1 GB) | NFR-PERF-001 holgado: p95 real ~41 ms a 100 req/s | ~55 |
| PostgreSQL gestionado (2 vCPU / 8 GB, 50 GB) | contratos + incidencias + tabla `ai_suggestions` | ~120 |
| Telemetría (métricas, trazas, logs · retención 30 d) | OTel collector propio + backend gestionado | ~35 |
| IA — clasificación de incidencias (Haiku) | 10 000 × ~0,0014 € (NFR-COST-001, margen 7×) | ~14 |
| Margen para picos y crecimiento (~25 %) | el presupuesto se revisa si el tráfico medio supera 2× | ~56 |
| **Total** | | **~280 < 300 ✓** |

Reglas:

- Cada partida traza a una métrica u origen verificable: lo que no se mide, no se defiende.
- La partida IA tiene además alerta propia (`AiCostBudgetExceeded`, ops/alerts.yml).
- Revisión trimestral, o inmediata si el error budget del SLO-2 entra en amarillo por capacidad.
