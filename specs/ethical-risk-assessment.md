# Ethical Risk Assessment — Clasificador de incidencias con IA

> **ESTADO: REVISIÓN PARCIAL.** Redactado con asistencia de IA. La clasificación del
> riesgo y la aceptación de los riesgos residuales las decide el ingeniero responsable, no la IA.
> **Relación con la implementación.** Este documento es parte de la spec: cada riesgo se convierte
> en un requisito verificable (INV-5, INV-6, INV-7, NFR-AI-001, NFR-AUDIT-001, NFR-COST-001) y el
> clasificador (`src/ai/classifyIncident.ts`) lo implementa. La sección 2.4 indica qué controles
> ya están en el código y cuáles quedan pendientes. Cualquier cambio de modelo, prompt
> o alcance del clasificador se refleja primero aquí.

Referencias: FR-DOM-014, NFR-AI-001, NFR-AUDIT-001, NFR-SEC-001, INV-5, INV-6, INV-7,
`specs/srs-telco.md`, `specs/spec-servicio.md`, `ops/slos.md`, Reglamento (UE) 2024/1689 (EU AI Act).

## 1. Clasificación del tipo de uso

| Aspecto | Valoración |
|---|---|
| Función de la IA | Clasificar el texto libre de una incidencia en una categoría y sugerir una resolución. |
| Nivel de autonomía | **Asistencia con humano en el circuito (human-in-the-loop).** La IA no decide ni ejecuta: toda sugerencia requiere decisión explícita de un técnico (INV-6). |
| Efecto sobre personas | Indirecto: afecta a la rapidez y calidad de la atención al cliente, no a derechos, acceso a servicios ni condiciones económicas. |
| Datos tratados | Descripción de la incidencia en texto libre (puede contener datos personales escritos por el cliente). |
| Modelo | `claude-haiku-4-5`, proveedor externo; salida validada con `zod`. |
| Nivel de riesgo (propuesto) | **Bajo-medio.** No es un uso de alto impacto mientras se mantengan los controles de la sección 2. Pasaría a alto si la IA empezara a actuar sin validación humana o a influir en suspensiones, cancelaciones o cobros. |
| Categoría EU AI Act (propuesta) | **Riesgo mínimo** (ver 1.1). No prohibido, no alto riesgo, sin obligaciones del art. 50 en el diseño actual. |

Criterio de reevaluación: este documento se revisa si cambia el modelo, el alcance, el nivel de
autonomía o se detecta un incidente atribuible a la IA.

### 1.1 Clasificación según el EU AI Act (Reglamento (UE) 2024/1689)

> Análisis técnico-funcional, **no es asesoría jurídica**. La clasificación definitiva y el
> calendario de aplicación los confirma el responsable legal / DPO.

**Conclusión propuesta: sistema de IA de riesgo mínimo** (fuera de los niveles prohibido y alto
riesgo). Se gestiona operativamente como **«riesgo limitado»**: aplicamos de forma voluntaria la
transparencia (el system prompt declara que un técnico revisa siempre la sugerencia), la
trazabilidad (INV-6) y la supervisión humana efectiva. Jurídicamente el art. 50 no obliga hoy
porque la IA no interactúa con clientes; tratarlo como limitado es la postura conservadora.
Se mantienen las obligaciones generales de alfabetización en IA (art. 4) y, si el alcance cambia,
reevaluación inmediata. No se trata de un sistema de propósito general ni de un modelo GPAI propio.

| Paso | Pregunta | Resultado | Fundamento |
|---|---|---|---|
| 1 | ¿Es un «sistema de IA»? | **Sí.** | Art. 3(1): sistema basado en máquina que infiere, a partir de la entrada, salidas (clasificación y sugerencia) que influyen en un entorno. |
| 2 | ¿Incurre en una práctica prohibida? | **No.** | Art. 5: no manipula, no puntúa socialmente, no categoriza biométricamente, no reconoce emociones ni explota vulnerabilidades. Solo clasifica el motivo técnico de una incidencia. |
| 3 | ¿Es de alto riesgo? | **No.** | Art. 6 y Anexo III: la gestión de incidencias de telecomunicaciones no figura entre los casos de uso listados. Ver la tabla de «áreas del Anexo III descartadas» más abajo. No es componente de seguridad de un producto regulado (art. 6(1)). |
| 4 | ¿Tiene obligaciones de transparencia (art. 50)? | **No por el diseño actual.** | La IA no interactúa con clientes (art. 50(1)) y su salida es una sugerencia interna para el técnico, no contenido publicado. Si se expusiera al cliente (chatbot, respuestas automáticas), el art. 50 pasaría a aplicar. |
| 5 | ¿Qué rol tenemos? | **Operador que integra un modelo de terceros.** | Anthropic es el proveedor del modelo GPAI (arts. 53 y 55 son suyas). Al integrarlo en un sistema propio y ponerlo en servicio bajo nuestro nombre actuamos como proveedor/desplegador (art. 3(3) y 3(4)) de un sistema de riesgo mínimo. |

## 2. Matriz de riesgos y controles

Probabilidad (P) e impacto (I): B = bajo, M = medio, A = alto. Riesgo residual tras aplicar el control.

| ID | Riesgo | P | I | Control implementado | Verificación | Residual |
|---|---|---|---|---|---|---|
| R-01 | **Acción autónoma de la IA**: la sugerencia modifica datos o decide sin supervisión. | B | A | `classifyIncident` no recibe repositorios ni escribe; devuelve solo `suggestion` o `manual_review` (INV-6). | Unit test de que el clasificador no escribe en ningún repositorio; contract test de la decisión del técnico. | Bajo |
| R-02 | **Sesgo de automatización**: el técnico acepta sugerencias sin criterio propio. | M | M | El system prompt declara que un humano revisa siempre; la decisión (aceptada, modificada, rechazada) se registra y se monitoriza `ai_acceptance_rate`. | Métrica `ai_acceptance_rate`; una tasa cercana al 100 % sostenida se trata como señal de alerta, no de éxito. | Medio |
| R-03 | **Clasificación errónea** que retrasa o desvía una incidencia (p. ej. una avería de red tratada como facturación). | M | M | Umbral `confidence < 0.8` → cola `MANUAL_REVIEW` (INV-5); categoría restringida a un enum cerrado. | Tests con confianza 0.55 y 0.92 (@AC-TELCO-004). | Medio |
| R-04 | **Confianza mal calibrada**: el modelo declara alta confianza y se equivoca. | M | M | El técnico siempre valida; alerta de deriva si `ai_confidence` p50 < 0,6 durante 1 h. | Métrica `ai_confidence`; muestreo periódico de sugerencias aceptadas frente a la resolución real. | Medio |
| R-05 | **Salida inválida o manipulada** (JSON roto, categoría inventada, texto excesivo). | M | B | Validación `zod` (enum, `confidence` 0..1, `suggestedResolution` ≤ 600); fallo → `manual_review`, nunca excepción (NFR-AI-001). | Tests: JSON malformado, categoría fuera del enum, resolución > 600 caracteres. | Bajo |
| R-06 | **Prompt injection** desde el texto libre del cliente (instrucciones incrustadas en la descripción). | M | M | La IA no tiene herramientas ni acceso a datos: lo peor que puede producir es una sugerencia equivocada, que pasa por validación `zod` y por el técnico. | Test de salida fuera de esquema; revisión manual de casos sospechosos. | Bajo-medio |
| R-07 | **Fuga de PII** hacia el proveedor de IA o hacia los logs. | M | A | Los logs usan solo identificadores opacos (INV-7, NFR-AUDIT-001). Al proveedor solo se envía la descripción de la incidencia, nunca nombre, teléfono ni documento del cliente. | Test que inspecciona los logs buscando patrones de PII (0 apariciones). **Pendiente:** el texto libre puede contener PII escrita por el cliente; evaluar un filtro previo de redacción y revisar el acuerdo de tratamiento de datos con el proveedor. | Medio |
| R-08 | **Falta de trazabilidad**: no se puede reconstruir quién decidió qué sobre una sugerencia. | B | A | Cada sugerencia y cada decisión se registra con `suggestion_id`, técnico opaco, decisión, modelo y marca de tiempo (INV-6, NFR-AUDIT-001). | Métrica `audit_log_completeness` (alerta crítica < 99,9 %). | Bajo |
| R-09 | **Sesgo o trato desigual** por idioma, forma de escribir o tipo de cliente. | B | M | El modelo solo ve la descripción, sin datos demográficos ni del contrato; las sugerencias no alteran condiciones del servicio. | Muestreo periódico de la tasa de `manual_review` y de aceptación por idioma y canal. **Pendiente:** definir quién ejecuta ese muestreo y con qué frecuencia. | Bajo |
| R-10 | **Indisponibilidad del proveedor de IA**. | M | B | Error del proveedor → `manual_review` (`ai_error`); el flujo de incidencias no depende de la IA para registrarse. | Test de error del proveedor; `ops/gameday-01-proveedor-ia.md`. | Bajo |
| R-11 | **Sobrecoste** por uso descontrolado o cambio de modelo. | B | B | Modelo pequeño; coste por llamada calculado con `response.usage` y registrado en `ai_cost_per_incident_eur`; alerta con p95 > 0,01 € (NFR-COST-001). | Test de cálculo y registro del coste; alerta `AiCostBudgetExceeded`. | Bajo |
| R-12 | **Dependencia del proveedor / cambio de modelo** altera el comportamiento sin aviso. | B | M | Modelo fijado por constante `MODEL`; tests con SDK mockeado; la deriva se detecta por `ai_confidence` y `ai_acceptance_rate`. | Revisión de este documento ante cualquier cambio de `MODEL`. | Bajo |

### 2.1 Controles organizativos, responsables y umbrales

Los controles técnicos de la matriz se completan con controles de proceso. Cada riesgo con residual
Medio o superior tiene un responsable y una evidencia revisable por alguien sin perfil técnico.
Los roles son propuestos y deben confirmarse.

| Riesgo | Control organizativo | Responsable (propuesto) | Evidencia |
|---|---|---|---|
| R-02 Sesgo de automatización | Si `ai_acceptance_rate` supera el **90 %** de forma sostenida, auditoría de muestreo de las decisiones; si baja del **50 %** semanal, revisión del prompt (umbral de `ops/slos.md`). | Lead de soporte | Registro de decisiones (INV-6) y métrica `ai_acceptance_rate`. |
| R-03 / R-04 Error y mala calibración | Revisión mensual de una muestra de sugerencias frente a la resolución real. | Lead de soporte | Informe mensual de muestreo. |
| R-07 Fuga de PII | System prompt versionado en el repo y revisado en cada cambio; el DPO es informado de cualquier campo nuevo que viaje al modelo. | DPO | Historial del repo, test anti-PII en CI, acta de revisión. |
| R-12 Deriva del modelo | Revisión mensual del prompt; GameDay periódico de caída del proveedor (`ops/gameday-01-proveedor-ia.md`). | Equipo de plataforma | `ops/alerts.yml`, runbook de cola saturada, métricas `ai_confidence` y `ai_invalid_output_total`. |

### 2.2 De la evaluación al control: requisitos verificables

Regla del temario: cada riesgo identificado se convierte en un requisito verificable. Esta tabla
cierra el ciclo; si un riesgo no tiene requisito, no está gestionado.

| Riesgo | Requisito o invariante que lo controla | Cómo se verifica |
|---|---|---|
| R-01, R-02, R-08 | INV-6 y NFR-AUDIT-001: toda sugerencia y decisión queda registrada con `suggestion_id`, técnico opaco, decisión, modelo y marca de tiempo; `audit_log_completeness` ≥ 99,9 %. | Unit y contract test; alerta crítica si la completitud baja. |
| R-03, R-05 | INV-5 y NFR-AI-001: validación `zod` y umbral `confidence < 0.8` → `MANUAL_REVIEW`. | Tests con SDK mockeado (@AC-TELCO-004). |
| R-07 | INV-7 y NFR-AUDIT-001: cero PII en logs. | Test que inspecciona los logs; debe romper el build, no ser una promesa. |
| R-04, R-12 | Métricas `ai_confidence` y `ai_invalid_output_total` en operación, más las puertas técnicas anteriores en línea. | Alertas en `ops/alerts.yml`. |
| R-11 | NFR-COST-001: coste por llamada registrado, alerta con p95 > 0,01 €. | Test de cálculo y registro del coste. |

### 2.3 Dónde NO se usa la IA

La IA no interviene en KYC, contratación, facturación ni en cambios de estado del servicio
(`transition()`). Esta frontera forma parte de la spec: ampliar el uso a cualquiera de estos
ámbitos exige actualizar antes este documento (ver disparadores de la sección 1.1).

### 2.4 Trazabilidad con la implementación

Estado de cada control frente al código. «Implementado» significa que existe en el repo y tiene test.

| Control | Riesgo | Dónde vive | Estado |
|---|---|---|---|
| El clasificador no recibe repositorios ni escribe datos; devuelve `suggestion` o `manual_review`. | R-01 | `classifyIncident` (firma sin dependencias de datos) | Implementado |
| Modelo fijado `claude-haiku-4-5` (constante `MODEL`), `max_tokens: 400`. | R-11, R-12 | `src/ai/classifyIncident.ts` | Implementado |
| System prompt: revisión humana siempre, JSON únicamente, no inventar datos del cliente, no prometer plazos. | R-02, R-05 | `SYSTEM_PROMPT` | Implementado |
| Validación `zod` (enum de categorías, `confidence` 0..1, resolución ≤ 600). Fallo → `manual_review` (`invalid_output`). | R-05 | `suggestionSchema` | Implementado, con test |
| Umbral `confidence < 0.8` → `manual_review` (`low_confidence`). | R-03 | `CONFIDENCE_THRESHOLD` | Implementado, con test (@AC-TELCO-004) |
| Error del proveedor → `manual_review` (`ai_error`), sin excepción. | R-10 | `try/catch` en `classifyIncident` | Implementado, con test |
| Coste calculado con `response.usage` y registrado en `ai_cost_per_incident_eur`. | R-11 | `computeCostEur`, `src/observability/metrics.ts` | Implementado, con test |
| Al modelo viaja solo la descripción de la incidencia. | R-07 | Parámetro `description` | Implementado (por diseño de la firma) |
| Tests con SDK mockeado (0 tokens). | todos | `tests/unit/classifyIncident.test.ts` | Implementado |
| Registro de la decisión del técnico (`suggestionId`, técnico opaco, decisión, marca de tiempo); una sola decisión por sugerencia (409 si se repite) y log `suggestion_decision` sin PII. | R-01, R-02, R-08 | `POST /suggestions/:id/decision` en `src/api/app.ts`, `src/domain/suggestionRules.ts` | Implementado, con test (@AC-TELCO-005) |
| Registro de cada sugerencia con modelo, resultado y coste (`ai_classification`) y al guardarla con su `suggestion_id` e `incident_id` opacos (`suggestion_created`), sin PII. | R-08 | `finish()` en `src/ai/classifyIncident.ts`, `storeSuggestion()` en `src/api/app.ts`, `src/observability/logger.ts` | Implementado, con test |
| Flujo de incidencia: la IA solo se invoca con servicio válido; confianza baja o salida inválida → `MANUAL_REVIEW`; sugerencia válida → `OPEN` pendiente del técnico, que decide con `suggestionId`. | R-01, R-03, R-05 | `POST /incidents`, `src/domain/incidentRules.ts`, inyección del clasificador en `src/server.ts` | Implementado, con test (@AC-TELCO-004, @AC-TELCO-005, @AC-TELCO-007, @AC-TELCO-008) |
| Cola de revisión manual consultable. | R-03 | `GET /incidents?status=MANUAL_REVIEW` | Implementado, con test |
| Test que inspecciona los logs buscando PII (0 apariciones). El logger lanza error ante campos prohibidos o valores con forma de PII. | R-07 | `src/observability/logger.ts`, `tests/unit/logging-no-pii.test.ts` | Implementado, con test |
| Métricas `ai_confidence` y `ai_invalid_output_total`. | R-04, R-12 | `src/ai/classifyIncident.ts`, `src/observability/metrics.ts` | Implementado, con test |
| Métrica `ai_acceptance_rate` (decisiones `ACCEPTED` sobre el total; `MODIFIED` y `REJECTED` no cuentan como aceptadas). Agregada, nunca por técnico. | R-02 | `acceptanceRate()` en `src/domain/auditMetrics.ts`, `GET /metrics` | Implementado, con test |
| Métrica `audit_log_completeness` (entradas de auditoría completas sobre las esperadas: una por sugerencia y una por decisión). | R-08 | `auditLogCompleteness()` en `src/domain/auditMetrics.ts`, `appendAudit()` en `src/api/store.ts`, `GET /metrics` | Implementado, con test |
| Test con descripción hostil (prompt injection): la respuesta fuera del esquema va a `manual_review` y el texto del cliente nunca entra en el system prompt. | R-06 | `tests/unit/classifyIncident.test.ts` | Implementado, con test |

Observación: el resultado de `classifyIncident` ya trae `reason` (`low_confidence`, `invalid_output`,
`ai_error`) y `costEur`; `ai_confidence` y `ai_invalid_output_total` ya se registran, y la cola de
revisión manual ya existe (`MANUAL_REVIEW`).

## 3. Principios que guían los controles

1. **Humano al mando.** La IA propone; el técnico decide y su decisión queda auditada.
2. **Fallar hacia lo seguro.** Ante duda, error o salida inválida, la incidencia va a revisión manual.
3. **Mínimo dato necesario.** Se envía al modelo solo el texto de la incidencia; los logs llevan identificadores opacos.
4. **Transparencia.** El técnico sabe que la sugerencia proviene de una IA y de qué modelo.
5. **Proporcionalidad.** Modelo pequeño para una tarea de clasificación simple; el riesgo y el coste se mantienen acotados.

## 4. Riesgos residuales y acciones pendientes

| Acción | Riesgo | Responsable | Estado |
|---|---|---|---|
| Añadir test de descripción hostil (prompt injection) al clasificador. | R-06 | Por asignar | Hecho |
| Evaluar redacción previa de PII en el texto libre y revisar el acuerdo con el proveedor de IA. | R-07 | Por asignar | Pendiente |
| Definir el muestreo periódico de calibración y de sesgo (frecuencia y responsable). | R-04, R-09 | Por asignar | Pendiente |
| Definir qué hace el equipo si `ai_acceptance_rate` se mantiene cerca del 100 %. | R-02 | Por asignar | Pendiente |
| Confirmar con legal / DPO la clasificación de riesgo mínimo y el calendario vigente del AI Act. | 1.1 | Por asignar | Pendiente |
| Documentar que `ai_acceptance_rate` es una métrica agregada y no se usa para evaluar a técnicos individuales. | 1.1 (Anexo III, punto 4) | Por asignar | Pendiente |
| Planificar la formación de alfabetización en IA (art. 4) para los técnicos. | 1.1 | Por asignar | Pendiente |

## 5. Aprobación

| Rol | Nombre | Fecha | Decisión |
|---|---|---|---|
| Ingeniero responsable | | | |
| Responsable de datos / privacidad | | | |

Los riesgos residuales **Medio** (R-02, R-03, R-04, R-07) requieren aceptación explícita en esta tabla.
