# Spec — Ciclo de vida del servicio e incidencias con IA

> **ESTADO: VALIDADA.** Deriva de `specs/srs-telco.md`: FR-DOM-004 a FR-DOM-012 (ciclo de vida del servicio) y FR-DOM-013 y
> FR-DOM-014 (incidencias y clasificación por IA), más FR-DOM-015 y FR-DOM-016 (deuda y servicio CANCELLED).

## 1. Máquina de estados del servicio

El estado del servicio es un **tipo cerrado** (union type / enum) con cinco valores. No se modela
nunca con booleanos (`isActive`, `isSuspended`), porque permiten estados imposibles.

```ts
type ServiceState = 'DRAFT' | 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
type ServiceEvent =
  | 'CONFIRM_CONTRACT'
  | 'INSTALLATION_COMPLETED'
  | 'PAYMENT_DEFAULT'
  | 'PAYMENT_REGULARIZED'
  | 'CANCEL';
```

### 1.1 Eventos

| Evento | Origen | Requisito |
|---|---|---|
| `CONFIRM_CONTRACT` | Agente comercial confirma la contratación | FR-DOM-008 |
| `INSTALLATION_COMPLETED` | Webhook del sistema de instalación | FR-DOM-009 |
| `PAYMENT_DEFAULT` | Webhook del sistema de facturación (impago) | FR-DOM-010 |
| `PAYMENT_REGULARIZED` | Webhook del sistema de facturación (pago regularizado) | FR-DOM-011 |
| `CANCEL` | Agente comercial cancela el servicio | FR-DOM-012 |

### 1.2 Tabla de transiciones válidas (`VALID_TRANSITIONS`)

| Desde | Evento | Hacia |
|---|---|---|
| `DRAFT` | `CONFIRM_CONTRACT` | `PENDING_INSTALLATION` |
| `DRAFT` | `CANCEL` | `CANCELLED` |
| `PENDING_INSTALLATION` | `INSTALLATION_COMPLETED` | `ACTIVE` |
| `PENDING_INSTALLATION` | `CANCEL` | `CANCELLED` |
| `ACTIVE` | `PAYMENT_DEFAULT` | `SUSPENDED` |
| `ACTIVE` | `CANCEL` | `CANCELLED` |
| `SUSPENDED` | `PAYMENT_REGULARIZED` | `ACTIVE` |
| `SUSPENDED` | `CANCEL` | `CANCELLED` |

Son **8 transiciones válidas**. Todo el resto de combinaciones estado × evento (5 × 5 = 25) son
**inválidas**: **17 combinaciones** que lanzan `InvalidTransitionError` y la API responde **HTTP 409**
sin modificar el estado. En particular, `CANCEL` sobre `CANCELLED` es inválida (409), no una
operación silenciosa sin efecto, y no existe ninguna transición que salga de `CANCELLED`.

### 1.3 Matriz completa estado × evento

`✔ estado` indica transición válida hacia ese estado; `409` indica transición inválida.

| Estado \ Evento | `CONFIRM_CONTRACT` | `INSTALLATION_COMPLETED` | `PAYMENT_DEFAULT` | `PAYMENT_REGULARIZED` | `CANCEL` |
|---|---|---|---|---|---|
| `DRAFT` | ✔ `PENDING_INSTALLATION` | 409 | 409 | 409 | ✔ `CANCELLED` |
| `PENDING_INSTALLATION` | 409 | ✔ `ACTIVE` | 409 | 409 | ✔ `CANCELLED` |
| `ACTIVE` | 409 | 409 | ✔ `SUSPENDED` | 409 | ✔ `CANCELLED` |
| `SUSPENDED` | 409 | 409 | 409 | ✔ `ACTIVE` | ✔ `CANCELLED` |
| `CANCELLED` | 409 | 409 | 409 | 409 | 409 |

## 2. Invariantes del dominio

| ID | Invariante | Cómo se verifica | Requisito |
|---|---|---|---|
| INV-1 | El estado del servicio es siempre uno de los cinco valores del tipo cerrado; no existen indicadores booleanos de estado ni valores fuera del conjunto. | Unit test (el compilador rechaza valores fuera del tipo) y contract test (la API rechaza un estado desconocido). | FR-DOM-005 |
| INV-2 | Todo cambio de estado pasa por la única función `transition()` y la tabla `VALID_TRANSITIONS`; una combinación fuera de la tabla lanza `InvalidTransitionError`, la API responde 409 y el estado queda sin cambios. | Unit test exhaustivo de las 25 combinaciones estado × evento (8 válidas, 17 → error) y contract test de HTTP 409. | FR-DOM-006 |
| INV-3 | `CANCELLED` es terminal: ningún evento, incluido `CANCEL`, produce una transición desde `CANCELLED`. | Unit test (los 5 eventos sobre `CANCELLED` lanzan error) y contract test (409). | FR-DOM-007 |
| INV-4 | No se crea un servicio para un cliente cuyo estado KYC no sea `VERIFIED`; la API responde 403. | Unit test de la regla y contract test de HTTP 403. | FR-DOM-003, FR-DOM-004 |
| INV-5 | Una sugerencia de la IA con `confidence < 0.8`, o con salida que no cumple el esquema `zod`, deja la incidencia en la cola de revisión manual `MANUAL_REVIEW`. | Unit test del clasificador con el SDK mockeado (0 tokens) en los casos de confianza baja y de JSON roto. | FR-DOM-014 |
| INV-6 | La IA solo clasifica y sugiere: nunca modifica datos. La sugerencia solo se aplica tras una decisión humana, que se registra con `suggestion_id`, el identificador opaco del técnico, la decisión (aceptada, modificada o rechazada) y la marca de tiempo. | Unit test (el clasificador no escribe en ningún repositorio), contract test de la decisión y revisión de los registros de auditoría (NFR-AUDIT-001). | FR-DOM-014 |
| INV-7 | Los registros y logs usan solo identificadores opacos (`customer_id: c-721`); ninguno contiene nombre, teléfono ni documento de identidad. | Test que inspecciona los logs del flujo completo (NFR-AUDIT-001). | NFR-AUDIT-001 |
| INV-8 | No se crea un servicio para un cliente con deuda pendiente mayor que 0; la API responde 409 con code `DEBT_OUTSTANDING`. | Unit test de la regla y contract test de HTTP 409. | FR-DOM-015 |
| INV-9 | No se registra una incidencia sobre un servicio inexistente (HTTP 404) ni sobre un servicio `CANCELLED` (HTTP 409, code `SERVICE_CANCELLED`); en ambos casos no se crea la incidencia. | Unit test de la regla y contract test de HTTP 404 y 409. | FR-DOM-013, FR-DOM-016 |

### 2.1 Contratos de los endpoints clave (precondición · postcondición · invariantes)

Todo contrato tiene tres partes (Módulo Construcción, vídeo 4). El Gherkin de la sección 3 hace
ejecutables estas tres patas; aquí quedan nombradas por endpoint.

| Endpoint | Precondición | Postcondición | Invariantes |
|---|---|---|---|
| `POST /contracts` | Cliente con KYC `VERIFIED` y sin deuda pendiente. | Contrato persistido en `DRAFT`. | INV-1, INV-4, INV-8 |
| `POST /contracts/:id/events` | La transición (estado, evento) está en la tabla. | Estado actualizado. | INV-2, INV-3 |
| `POST /incidents` | El servicio existe y no está `CANCELLED`. | Incidencia persistida; en `MANUAL_REVIEW` si `confidence < 0.8`. | INV-5, INV-9 |

## 3. Criterios de aceptación (Gherkin)

```gherkin
Feature: Ciclo de vida del servicio e incidencias con IA bajo control humano

  @AC-TELCO-001
  Scenario: La instalación completada activa el servicio
    Given un servicio en estado PENDING_INSTALLATION
    When el sistema de instalación notifica INSTALLATION_COMPLETED con firma válida
    Then el servicio pasa a ACTIVE y la respuesta es HTTP 200

  @AC-TELCO-002
  Scenario: CANCELLED es terminal
    Given un servicio en estado CANCELLED
    When se envía cualquier evento, incluido CANCEL
    Then la respuesta es HTTP 409 y el servicio permanece en CANCELLED

  @AC-TELCO-003
  Scenario: No se contrata sin KYC verificado
    Given un cliente con KYC en estado PENDING
    When el agente comercial intenta contratar un servicio FIBER
    Then la respuesta es HTTP 403 y no se crea ningún servicio

  @AC-TELCO-004
  Scenario: Confianza baja va a revisión manual
    Given una incidencia registrada
    When el clasificador de IA devuelve una sugerencia con confidence 0.55
    Then la incidencia pasa a MANUAL_REVIEW y la sugerencia no modifica ningún dato

  @AC-TELCO-005
  Scenario: Toda sugerencia registra la decisión humana
    Given una sugerencia de resolución generada por la IA
    When el técnico la acepta, modifica o rechaza
    Then queda un registro con suggestion_id, técnico, decisión y timestamp

  @AC-TELCO-006
  Scenario: No se contrata con deuda pendiente
    Given un cliente con KYC VERIFIED y deuda pendiente mayor que 0
    When el agente comercial intenta contratar un servicio FIBER
    Then la respuesta es HTTP 409 con code DEBT_OUTSTANDING y no se crea ningún servicio

  @AC-TELCO-007
  Scenario: No se abre una incidencia sobre un servicio CANCELLED
    Given un servicio en estado CANCELLED
    When se registra una incidencia sobre ese servicio
    Then la respuesta es HTTP 409 con code SERVICE_CANCELLED y no se crea ninguna incidencia

  @AC-TELCO-008
  Scenario: No se abre una incidencia sobre un servicio inexistente
    Given un identificador de servicio que no existe
    When se registra una incidencia sobre ese servicio
    Then la respuesta es HTTP 404 con code y message y no se crea ninguna incidencia
```

## 4. Trazabilidad

| Elemento | Requisito |
|---|---|
| Máquina de estados, `VALID_TRANSITIONS`, INV-1, INV-2, INV-3 | FR-DOM-005, FR-DOM-006, FR-DOM-007, FR-DOM-008, FR-DOM-009, FR-DOM-010, FR-DOM-011, FR-DOM-012 |
| INV-4, AC-TELCO-003 | FR-DOM-003, FR-DOM-004 |
| INV-5, INV-6, AC-TELCO-004, AC-TELCO-005 | FR-DOM-013, FR-DOM-014, NFR-AI-001, NFR-AUDIT-001 |
| INV-8, AC-TELCO-006 | FR-DOM-015 |
| INV-9, AC-TELCO-007, AC-TELCO-008 | FR-DOM-013, FR-DOM-016 |
| AC-TELCO-001 | FR-DOM-009, NFR-SEC-001 |
| AC-TELCO-002 | FR-DOM-007 |
