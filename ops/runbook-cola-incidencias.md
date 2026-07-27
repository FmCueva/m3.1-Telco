# Runbook: Cola MANUAL_REVIEW saturada (> 50 durante 2 min)

**Trigger:** alerta `IncidentManualQueueSaturated` (Prometheus, severidad warning).
**Flag asociado:** `ai_classification_disabled` · tipo: ops/kill-switch · owner: on-call (SRE) ·
sin fecha de caducidad: es un kill-switch permanente, no un flag de release
(taxonomía y política de flags del Módulo Operación, vídeo 4).
**Contexto:** las incidencias que la IA no clasifica con confianza ≥ 0,8 (o con salida
inválida) van a la cola de revisión humana. Si crece, o la IA se degradó, o hay un pico
real de incidencias, o el proveedor IA está caído (las incidencias siguen creándose: el
sistema degrada a manual, nunca se bloquea).

## Diagnóstico (en orden, comandos copiables)

```bash
# 1. ¿Está cayendo la confianza media? (drift del modelo o prompt roto)
promtool query instant 'histogram_quantile(0.5, rate(ai_confidence_bucket[30m]))'

# 2. ¿Hay errores del proveedor IA?
jq 'select(.level=="ERROR" and .module=="ai")' /var/log/telco/app.log | tail -20

# 3. ¿Es un pico real de incidencias? (incidente de red de verdad)
promtool query instant 'sum(rate(http_requests_total{route="/incidents",method="POST"}[15m]))'
```

## Acciones (de menor a mayor impacto, idempotentes)

1. Si es caída del proveedor IA: activar el flag `ai_classification_disabled` —
   `AI_CLASSIFICATION_DISABLED=true` en `.env` y `docker compose up -d api`
   (la api lo consulta en cada llamada). Todo pasa a manual, el sistema sigue.
2. Si es drift de confianza: reprocesar la cola con el prompt anterior
   (`npm run ai:reprocess -- --prompt-version=prev`).
3. Si es pico real: avisar a soporte para refuerzo del turno; las incidencias no se pierden.

## Verificación

`incidents_manual_review_queue_size < 20` durante 15 min consecutivos.

## Rollback

Desactivar el flag, restaurar prompt-version actual. Documentar en el ticket y
actualizar este runbook en el post-mortem (regla: living doc).
