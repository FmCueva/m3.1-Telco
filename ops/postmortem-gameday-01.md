# Post-mortem — GameDay 01: caída del proveedor de IA

> Plantilla: sección 8 del plan `ops/gameday-01-proveedor-ia.md` (post-mortem en caliente,
> rellenado en menos de 15 min al terminar — Módulo Operación, vídeo 5).
> Regla del método: verificación + post-mortem → spec mejorada. Blameless: hablamos de
> sistemas y de señales, no de culpables.

**Ejecución:** entorno de demo local (docker compose) · duración 15 min · roles según el plan (§6).

## Qué esperábamos (hipótesis, copiada del plan)

> Si el proveedor de IA cae, las incidencias siguen creándose (degradación a cola
> MANUAL_REVIEW, nunca bloqueo), la alerta `IncidentManualQueueSaturated` dispara en
> < 2 min, y con el flag `ai_classification_disabled` activado la cola se drena por
> debajo de 20 en < 15 min.

## Qué pasó de verdad

**Hipótesis confirmada**, con una desviación que merece registro:

- Ningún `POST /incidents` devolvió 5xx durante el corte: el sistema degradó, no se bloqueó. ✓
- La cola creció, cruzó el umbral (> 50) y la alerta llegó con su `runbook_url` en el payload. ✓
- Con el flag activado, la cola bajó de 20 dentro de la ventana de 15 minutos. ✓
- **Desviación:** `ai_invalid_output_total` apenas se movió. El plan (§4) esperaba que creciera
  durante el corte, pero un proveedor caído no produce salidas inválidas: produce errores de red,
  que siguen otro camino. La señal útil fueron los logs `level=ERROR module=ai` (paso 2 del
  diagnóstico del runbook), no esa métrica.

## Línea de tiempo

| T+ | Evento |
|---|---|
| 0:00 | Game Master corta la red del contenedor `api` hacia el proveedor de IA |
| 0:30 | Las incidencias siguen entrando (201) y van cayendo a MANUAL_REVIEW |
| 2:00 | La cola supera 50; dispara `IncidentManualQueueSaturated` con su `runbook_url` |
| 3:00 | On-call shadow ejecuta el diagnóstico del runbook → errores del proveedor (paso 2) |
| 4:00 | Acción 1 del runbook: flag `ai_classification_disabled` activado |
| 14:00 | Verificación: cola < 20; la alerta se resuelve |
| 15:00 | Restauración: red reconectada, flag desactivado, estado inicial verificado |

## Una acción concreta (living doc: se aplica hoy, no "más adelante")

Corregir la fila de `ai_invalid_output_total` en `ops/gameday-01-proveedor-ia.md` §4: la
expectativa pasa a "estable durante el corte (un proveedor caído no genera salidas inválidas);
la señal de caída son los logs `level=ERROR module=ai`". **Aplicada en este mismo commit.**
El runbook no necesita cambios: su paso 2 de diagnóstico ya apuntaba a la señal correcta.
