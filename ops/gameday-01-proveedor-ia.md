# GameDay 01: caída del proveedor de IA (JOB-008)

**Objetivo:** validar en condiciones controladas que el sistema degrada (nunca se bloquea)
cuando el proveedor de IA no responde, y que la cadena detección → runbook → mitigación →
verificación funciona de verdad. Trazado a NFR-DISP-001 y al runbook
`ops/runbook-cola-incidencias.md`.

## 1. Hipótesis

> Si el proveedor de IA cae, las incidencias siguen creándose (degradación a cola
> MANUAL_REVIEW, nunca bloqueo), la alerta `IncidentManualQueueSaturated` dispara en
> < 2 min, y con el flag `ai_classification_disabled` activado la cola se drena por
> debajo de 20 en < 15 min.

Una hipótesis de GameDay es una afirmación verificable: al final del ejercicio sabremos si
era cierta o no. No "vamos a ver qué pasa", sino "esperamos exactamente esto".

## 2. Escenario

Corte de red del contenedor `api` hacia el proveedor de IA, simulando que su API está caída:

```bash
docker network disconnect <red-externa> telco-api
```

Las incidencias siguen entrando por `POST /incidents`; ninguna debe perderse ni devolver 5xx.

## 3. Alcance acotado

- Solo el entorno de demo local (docker compose). **Nada de producción.**
- Duración máxima: **30 min** (JOB-008).
- Solo el módulo `ai`: clientes y contratos no se tocan en ningún momento.

## 4. Métricas a observar

| Métrica | Qué esperamos |
|---|---|
| `incidents_manual_review_queue_size` | sube, cruza el umbral de alerta (> 50), baja a < 20 tras la mitigación |
| `ai_invalid_output_total` | estable durante el corte (un proveedor caído no genera salidas inválidas); la señal de caída son los logs `level=ERROR module=ai` |
| Ratio 5xx de `POST /incidents` (SLO-2) | **cero**: si aparece un 5xx, la hipótesis falla |
| `ai_confidence` p50 | sin tráfico de IA durante el corte; recupera su nivel al restaurar |

## 5. Escape hatch

Si algo se tuerce, la vuelta atrás es inmediata e idempotente:

```bash
docker network connect <red-externa> telco-api   # restaurar conectividad
# + desactivar el flag ai_classification_disabled (ver runbook, sección Rollback)
```

**Criterio de aborto:** cualquier 5xx en `POST /incidents`, o superar los 30 min de ejercicio.

## 6. Roles

| Rol | Responsabilidad |
|---|---|
| **Game Master** | inyecta el fallo y custodia el escape hatch |
| **Observador** | vigila métricas y alertas; canta los cruces de umbral |
| **On-call shadow** | responde siguiendo SOLO `ops/runbook-cola-incidencias.md`, sin conocimiento previo del escenario |
| **Comunicación** | anota la línea de tiempo (hora exacta de cada evento) |

## 7. Checklist de ejecución

1. [ ] Estado inicial verificado: cola < 20, sin alertas activas, `GET /healthz` en 200.
2. [ ] **Inyección:** Game Master ejecuta `docker network disconnect`; los logs muestran errores del proveedor IA.
3. [ ] Las incidencias siguen creándose (201) y van cayendo a la cola MANUAL_REVIEW.
4. [ ] **Detección:** dispara `IncidentManualQueueSaturated` con su `runbook_url` en el payload.
5. [ ] **Diagnóstico:** on-call shadow ejecuta los comandos del runbook en orden (confianza, errores del proveedor, pico real) y concluye: caída del proveedor.
6. [ ] **Mitigación:** activa el flag `ai_classification_disabled` (acción 1 del runbook).
7. [ ] **Verificación:** `incidents_manual_review_queue_size < 20`; la alerta se resuelve.
8. [ ] **Restauración:** `docker network connect` + desactivar el flag.
9. [ ] Comunicación cierra la línea de tiempo; se convoca el post-mortem en caliente.

## 8. Post-mortem en caliente (rellenar al terminar, en < 15 min)

- **Qué esperábamos:** _(copiar la hipótesis)_
- **Qué pasó de verdad:** _(incluir desviaciones, por pequeñas que sean)_
- **Línea de tiempo:** _(hora de inyección, alerta, mitigación, verificación, restauración)_
- **Una acción concreta** sobre la spec o el runbook: _(regla "living doc": si el runbook
  no contó toda la verdad, se actualiza en este momento, no "más adelante")_

→ Post-mortem de la ejecución del vídeo: `ops/postmortem-gameday-01.md`
