# SRS — Backend de operadora TELCO

> **VERSIÓN: 1.4** · **ESTADO: VALIDADA** · Última actualización: 2026-10-29.

## 1. Propósito y alcance

**Propósito.** Definir los requisitos del backend de una operadora de telecomunicaciones que gestiona el ciclo de vida completo: alta de clientes, verificación de identidad (KYC), contratación de servicios (fibra, móvil, packs), gestión del ciclo de vida del servicio e incidencias con clasificación asistida por IA, **siempre bajo validación humana**.

**Dentro de alcance**

- Alta de clientes y verificación de identidad (KYC).
- Contratación de servicios de tipo `FIBER`, `MOBILE` y `PACK`.
- Ciclo de vida del servicio con estados `DRAFT`, `PENDING_INSTALLATION`, `ACTIVE`, `SUSPENDED` y
  `CANCELLED`.
- Registro de incidencias y clasificación sugerida por IA, validada por una persona.

**Fuera de alcance**

- Facturación real (solo se recibe la notificación de impago o de pago regularizado).
- Portabilidad numérica.
- Interfaz de usuario (UI).
- Notificaciones push.

## 2. Actores

| Actor | Tipo | Descripción |
|---|---|---|
| Agente comercial | Humano | Persona que da de alta a clientes y contrata servicios. |
| Técnico de soporte | Humano | Revisa y valida las sugerencias de clasificación de la IA y trabaja la cola de revisión manual. |
| Sistema de instalación | Sistema externo | Notifica por webhook que la instalación de un servicio se ha completado. |
| Sistema de facturación | Sistema externo | Notifica por webhook un impago o un pago regularizado. |
| Proveedor de verificación KYC | Sistema externo | Devuelve el resultado de la verificación de identidad. |
| Asistente de IA | Sistema externo | Clasifica incidencias y sugiere categoría y confianza. Nunca modifica datos ni decide solo. |

## 3. Requisitos funcionales

| ID | Enunciado verificable | Prioridad |
|---|---|---|
| FR-DOM-001 | El sistema permite dar de alta un cliente con los datos mínimos identificados (nombre, documento de identidad, teléfono de contacto) y devuelve un `customer_id` opaco; un alta con algún dato obligatorio ausente responde HTTP 400. | Must |
| FR-DOM-002 | Todo cliente nuevo queda con estado KYC `PENDING`; solo pasa a `VERIFIED` o `REJECTED` al recibir el resultado del proveedor de verificación. | Must |
| FR-DOM-003 | El sistema rechaza con HTTP 403 la contratación de un servicio para un cliente cuyo estado KYC no es `VERIFIED`. | Must |
| FR-DOM-004 | El sistema permite contratar un servicio de tipo `FIBER`, `MOBILE` o `PACK` para un cliente verificado y lo crea en estado `DRAFT`; cualquier otro tipo se rechaza con HTTP 400. | Must |
| FR-DOM-005 | El estado del servicio es un tipo cerrado con exactamente cinco valores (`DRAFT`, `PENDING_INSTALLATION`, `ACTIVE`, `SUSPENDED`, `CANCELLED`); no existen indicadores booleanos de estado y no es posible persistir un valor fuera de ese conjunto. | Must |
| FR-DOM-006 | Todo cambio de estado se realiza mediante una única función `transition()` que consulta una tabla de transiciones válidas; una transición no permitida lanza `InvalidTransitionError` y la API responde HTTP 409, dejando el estado sin cambios. | Must |
| FR-DOM-007 | `CANCELLED` es un estado terminal: cualquier intento de transición desde `CANCELLED` responde HTTP 409. | Must |
| FR-DOM-008 | Al confirmar la contratación, el servicio pasa de `DRAFT` a `PENDING_INSTALLATION`. | Must |
| FR-DOM-009 | Al recibir el webhook de instalación completada, el servicio pasa de `PENDING_INSTALLATION` a `ACTIVE`; si el servicio no está en `PENDING_INSTALLATION`, la API responde HTTP 409. | Must |
| FR-DOM-010 | Al recibir el webhook de impago, el servicio pasa de `ACTIVE` a `SUSPENDED`; si el servicio no está en `ACTIVE`, la API responde HTTP 409. | Must |
| FR-DOM-011 | Al recibir el webhook de pago regularizado, el servicio pasa de `SUSPENDED` a `ACTIVE`; si el servicio no está en `SUSPENDED`, la API responde HTTP 409. | Should |
| FR-DOM-012 | El sistema permite cancelar un servicio desde `DRAFT`, `PENDING_INSTALLATION`, `ACTIVE` o `SUSPENDED`, llevándolo a `CANCELLED`. | Must |
| FR-DOM-013 | El sistema permite registrar una incidencia asociada a un cliente y a un servicio existentes, con descripción en texto libre, y devuelve un `incident_id` opaco; si el servicio no existe, la API responde HTTP 404 y no crea la incidencia. | Must |
| FR-DOM-014 | Tras registrarse una incidencia, el clasificador de IA produce una sugerencia de categoría con un valor de `confidence` entre 0 y 1; si `confidence < 0.8` la incidencia pasa a la cola de revisión manual; en todos los casos la sugerencia solo se aplica tras la validación explícita de un técnico, y la IA nunca modifica datos. | Must |
| FR-DOM-015 | El sistema rechaza con HTTP 409 y code `DEBT_OUTSTANDING` la contratación de un servicio para un cliente con deuda pendiente mayor que 0, sin crear ningún servicio. | Must |
| FR-DOM-016 | El sistema rechaza con HTTP 409 y code `SERVICE_CANCELLED` el registro de una incidencia sobre un servicio en estado `CANCELLED`, sin crear la incidencia. | Must |
| FR-DOM-017 | El sistema permite a un técnico resolver una incidencia en estado `OPEN` o `MANUAL_REVIEW` indicando su identificador opaco (`technicianId`); la incidencia pasa a `RESOLVED` y queda registrado quién la resolvió y cuándo. Resolver una incidencia ya `RESOLVED` responde HTTP 409 con code `INCIDENT_ALREADY_RESOLVED`; una incidencia inexistente responde HTTP 404 con code `INCIDENT_NOT_FOUND`; una petición sin `technicianId` responde HTTP 400. En ningún caso la resolución aplica una sugerencia de la IA ni modifica el servicio. | Must |

## 4. Requisitos no funcionales

| ID | Enunciado medible | Método de verificación |
|---|---|---|
| NFR-PERF-001 | En las operaciones de la API que no invocan a la IA (alta, contratación, transición de estado, consulta), el percentil 95 de latencia es inferior a 200 ms con 50 peticiones por segundo sostenidas durante 60 s. | Prueba de carga (`scripts/load-test`) con umbral que falla el job si se supera. |
| NFR-SEC-001 | Los webhooks de instalación y de facturación solo se aceptan con una firma HMAC-SHA256 válida; el 100 % de las peticiones con firma ausente o inválida recibe HTTP 401 y no altera ningún estado. | Test de contrato con firma válida, inválida y ausente. |
| NFR-AUDIT-001 | El 100 % de las sugerencias de la IA y de las decisiones del técnico queda registrado con identificadores opacos, marca de tiempo y modelo; ningún log contiene nombre, teléfono ni documento de identidad (0 apariciones de PII). | Test que inspecciona los logs generados en el flujo completo y busca patrones de PII. |
| NFR-AI-001 | La salida del clasificador se valida con `zod`; el 100 % de las respuestas con JSON roto o fuera del esquema genera una incidencia en revisión manual sin lanzar excepción; el coste por llamada se calcula y se registra como métrica en cada clasificación. | Tests del clasificador con el SDK mockeado (0 tokens): respuesta válida, JSON roto y confianza baja; comprobación de la métrica de coste. |
| NFR-QUAL-001 | La cobertura de líneas de la suite de tests es de al menos el 80 % y toda prueba lleva una etiqueta `@AC-TELCO-nnn`; el pipeline de CI falla si cualquiera de las dos condiciones no se cumple. | Gate de cobertura (`scripts/coverage-gate.ts`) y gate de trazabilidad (`scripts/check-ac-coverage.sh`) en CI. |
| NFR-OPS-001 | El 95 % de las incidencias que entran en `MANUAL_REVIEW` se resuelve en menos de 4 horas, medido sobre una ventana de 28 días móviles. El sistema expone el tiempo desde la entrada en `MANUAL_REVIEW` hasta la resolución como histograma agregado (`incident_manual_review_resolution_seconds`, con un límite de bucket en 14 400 s), sin identificadores de técnico. | Test unitario del cálculo de duraciones, test de contrato de `GET /metrics` y SLO-3 en `ops/slos.md` con su alerta. |
| NFR-DISP-001 | El 99,5 % de las peticiones `POST /incidents` devuelve un código distinto de 5xx, medido sobre una ventana de 28 días móviles. | SLO-2 en `ops/slos.md` y alerta `IncidentsBurnRateHigh` en `ops/alerts.yml`. |

## 5. Restricciones

- **Arquitectura:** monolito modular (ADR-001) con los módulos `customers`, `contracts`, `incidents`
  y `ai`; cada módulo solo se importa por su `index.ts` público, vigilado por dependency-cruiser en CI.
- **Despliegue:** en contenedor, con imagen de hasta 250 MB y usuario no-root; el tamaño lo verifica
  el gate de imagen del CI.
- **Dominio puro:** `src/domain/` no realiza IO (sin base de datos ni red); los efectos viven en la
  API y la infraestructura.
- **Tecnología:** TypeScript ESM sobre Node 22, Fastify, PostgreSQL, Vitest, ESLint y Prettier.
- **IA:** modelo pequeño (`haiku`); la IA solo clasifica y sugiere, siempre con validación humana.
- **Método:** sin especificación validada no se implementa código; todo requisito tiene un ID
  verificable y todo test traza a un criterio de aceptación.
- **Alcance:** no se incluyen las funcionalidades indicadas como fuera de alcance en la sección 1.
- **Presupuesto operativo total:** menos de 300 €/mes a carga nominal; se revisa en
  `ops/presupuesto-operativo.md`.
