# Spec — Ciclo de vida del servicio e incidencias con IA

> **BORRADOR generado por IA (prompt 02), pendiente de revisión humana.** Deriva de
> `specs/srs-telco.md`: FR-DOM-004 a FR-DOM-012 (ciclo de vida del servicio) y FR-DOM-013 y
> FR-DOM-014 (incidencias y clasificación por IA).

## 1. Máquina de estados del servicio

El estado del servicio es un **tipo cerrado** (union type / enum) con cinco valores. No se modela
nunca con booleanos (`isActive`, `isSuspended`), porque permiten estados imposibles.

```ts
type ServiceState = 'DRAFT' | 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
type ServiceEvent =
  | 'CONFIRM_CONTRACT'
  | 'INSTALLATION_COMPLETED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'CANCEL';
```

### 1.1 Eventos

| Evento | Origen | Requisito |
|---|---|---|
| `CONFIRM_CONTRACT` | Agente comercial confirma la contratación | FR-DOM-008 |
| `INSTALLATION_COMPLETED` | Webhook del sistema de instalación | FR-DOM-009 |
| `PAYMENT_OVERDUE` | Webhook del sistema de facturación (impago) | FR-DOM-010 |
| `PAYMENT_RECEIVED` | Webhook del sistema de facturación (pago regularizado) | FR-DOM-011 |
| `CANCEL` | Agente comercial cancela el servicio | FR-DOM-012 |

### 1.2 Tabla de transiciones válidas (`VALID_TRANSITIONS`)

| Desde | Evento | Hacia |
|---|---|---|
| `DRAFT` | `CONFIRM_CONTRACT` | `PENDING_INSTALLATION` |
| `DRAFT` | `CANCEL` | `CANCELLED` |
| `PENDING_INSTALLATION` | `INSTALLATION_COMPLETED` | `ACTIVE` |
| `PENDING_INSTALLATION` | `CANCEL` | `CANCELLED` |
| `ACTIVE` | `PAYMENT_OVERDUE` | `SUSPENDED` |
| `ACTIVE` | `CANCEL` | `CANCELLED` |
| `SUSPENDED` | `PAYMENT_RECEIVED` | `ACTIVE` |
| `SUSPENDED` | `CANCEL` | `CANCELLED` |

Son **8 transiciones válidas**. Todo el resto de combinaciones estado × evento (5 × 5 = 25) son
**inválidas**: **17 combinaciones** que lanzan `InvalidTransitionError` y la API responde **HTTP 409**
sin modificar el estado. En particular, `CANCEL` sobre `CANCELLED` es inválida (409), no una
operación silenciosa sin efecto, y no existe ninguna transición que salga de `CANCELLED`.

### 1.3 Matriz completa estado × evento

`✔ estado` indica transición válida hacia ese estado; `409` indica transición inválida.

| Estado \ Evento | `CONFIRM_CONTRACT` | `INSTALLATION_COMPLETED` | `PAYMENT_OVERDUE` | `PAYMENT_RECEIVED` | `CANCEL` |
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
| INV-4 | No se crea un servicio para un cliente cuyo estado KYC no sea `VERIFIED`; la API responde 422. | Unit test de la regla y contract test de HTTP 422. | FR-DOM-003, FR-DOM-004 |
| INV-5 | Una sugerencia de la IA con `confidence < 0.8`, o con salida que no cumple el esquema `zod`, deja la incidencia en la cola de revisión manual `MANUAL_REVIEW`. | Unit test del clasificador con el SDK mockeado (0 tokens) en los casos de confianza baja y de JSON roto. | FR-DOM-014 |
| INV-6 | La IA solo clasifica y sugiere: nunca modifica datos. La sugerencia solo se aplica tras una decisión humana, que se registra con el identificador opaco del técnico, la marca de tiempo y la sugerencia aceptada o rechazada. | Unit test (el clasificador no escribe en ningún repositorio), contract test de la decisión y revisión de los registros de auditoría (NFR-AUDIT-001). | FR-DOM-014 |
| INV-7 | Los registros y logs usan solo identificadores opacos (`customer_id: c-721`); ninguno contiene nombre, teléfono ni documento de identidad. | Test que inspecciona los logs del flujo completo (NFR-AUDIT-001). | NFR-AUDIT-001 |

## 3. Criterios de aceptación (Gherkin)

```gherkin
# language: es
Característica: Ciclo de vida del servicio e incidencias con IA bajo control humano

  @AC-TELCO-001
  Escenario: Activación tras la instalación
    Dado un servicio en estado "PENDING_INSTALLATION"
    Cuando el sistema de instalación notifica "INSTALLATION_COMPLETED" con firma válida
    Entonces el servicio pasa a estado "ACTIVE"
    Y la respuesta es HTTP 200

  @AC-TELCO-002
  Escenario: CANCELLED es un estado terminal
    Dado un servicio en estado "CANCELLED"
    Cuando se envía cualquier evento sobre el servicio, incluido "CANCEL"
    Entonces la respuesta es HTTP 409
    Y el servicio permanece en estado "CANCELLED"

  @AC-TELCO-003
  Escenario: Contratación sin KYC verificado
    Dado un cliente con estado KYC "PENDING"
    Cuando el agente comercial intenta contratar un servicio "FIBER" para ese cliente
    Entonces la respuesta es HTTP 422
    Y no se crea ningún servicio

  @AC-TELCO-004
  Escenario: Clasificación por IA con confianza baja
    Dado una incidencia registrada con descripción en texto libre
    Cuando el clasificador de IA devuelve una sugerencia con "confidence" 0.55
    Entonces la incidencia pasa a la cola "MANUAL_REVIEW"
    Y ningún dato de la incidencia ni del servicio se modifica por la sugerencia

  @AC-TELCO-005
  Escenario: Registro de la decisión humana sobre la sugerencia de la IA
    Dado una incidencia en la cola "MANUAL_REVIEW" con una sugerencia de la IA
    Cuando un técnico de soporte acepta o rechaza la sugerencia
    Entonces la decisión se registra con el identificador opaco del técnico y la marca de tiempo
    Y solo entonces la categoría de la incidencia se aplica según la decisión del técnico
```

## 4. Trazabilidad

| Elemento | Requisito |
|---|---|
| Máquina de estados, `VALID_TRANSITIONS`, INV-1, INV-2, INV-3 | FR-DOM-005, FR-DOM-006, FR-DOM-007, FR-DOM-008, FR-DOM-009, FR-DOM-010, FR-DOM-011, FR-DOM-012 |
| INV-4, AC-TELCO-003 | FR-DOM-003, FR-DOM-004 |
| INV-5, INV-6, AC-TELCO-004, AC-TELCO-005 | FR-DOM-013, FR-DOM-014, NFR-AI-001, NFR-AUDIT-001 |
| AC-TELCO-001 | FR-DOM-009, NFR-SEC-001 |
| AC-TELCO-002 | FR-DOM-007 |
