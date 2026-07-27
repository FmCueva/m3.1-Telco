# CLAUDE.md — Convenciones del proyecto TELCO (SDD)

Contexto para Claude Code al trabajar en este repo. Backend de una operadora (clientes, contratos,
estado del servicio, incidencias con IA) construido con **Spec-Driven Development**. Estas reglas no
son opcionales: son el método.

## Regla de oro
- **Sin especificación validada, no se implementa código.** Primero SRS → spec → plan; luego código.
- La IA **redacta**, el ingeniero **decide**. Nada de lo que genera la IA entra sin revisión humana.

## Qué genera la IA vs qué decide el humano
- **IA genera (y se revisa):** SRS, spec, plan de jobs, tests, código de la feature.
- **Humano decide (a mano, NO los generes tú):** los **ADR** (arquitectura), los **SLOs**, el
  **runbook** y el **postmortem**. Son criterio humano.
- **Infra se hereda del repo:** CI (`.github/workflows/`), Docker, observabilidad, `docker-compose`,
  scripts de gate. Se copia y se adapta, no se reinventa.

## Dominio (lo más importante)
- El estado del servicio es un **union type cerrado**, **NUNCA booleanos** (`isActive`,
  `isSuspended` permiten estados imposibles). Estados: `DRAFT`, `PENDING_INSTALLATION`, `ACTIVE`,
  `SUSPENDED`, `CANCELLED`.
- Toda transición pasa por una **única función `transition()`** con una **tabla de transiciones
  válidas** (`VALID_TRANSITIONS`). Transición inválida → `InvalidTransitionError` → HTTP 409 (INV-2).
- **`CANCELLED` es terminal** (INV-3): no se sale de ahí.
- `src/domain/` es **puro, sin IO** (sin base de datos, sin red). Los efectos van en API/infra.

## Trazabilidad (se verifica en CI)
- **Todo requisito** tiene ID verificable: `FR-DOM-nnn` / `NFR-XXX-nnn`. Si no se puede testear,
  reescríbelo con un número (nada de "rápido" o "fácil de usar").
- **Todo test** traza a un criterio de aceptación: etiqueta `@AC-TELCO-nnn`.
- **Todo JOB** del plan traza a un requisito del SRS. Si no traza a ninguno, el JOB no existe.

## IA bajo control (clasificador de incidencias)
- La IA **solo clasifica y sugiere**; **nunca modifica datos ni decide sola**. Siempre validación humana.
- Salida **validada con `zod`**; un JSON roto es una incidencia más, no una excepción que explota.
- `confidence < 0.8` → a la **cola de revisión manual**.
- El coste por llamada se **calcula y se registra** como métrica. Modelo pequeño (`haiku`).
- Los tests del clasificador corren con el **SDK mockeado** (0 tokens).

## Arquitectura y fronteras
- **Monolito modular** (ADR-001), no microservicios. Módulos: `customers`, `contracts`, `incidents`, `ai`.
- Un módulo solo se importa por su **`index.ts` público** — nunca por dentro. Lo vigila
  **dependency-cruiser** en CI (es la "policía" del ADR-001).
- Capa de API **delgada**: traduce HTTP a llamadas de dominio, sin reglas de negocio.

## Calidad y estilo
- **TDD**: primero el test (en rojo), luego la implementación mínima (a verde).
- **Logs sin PII**: identificadores opacos (`customer_id: c-721`), nunca nombre/teléfono/documento.
- TypeScript ESM, Node 22. Lint = Prettier + ESLint. Cobertura ≥ 80 % (gate en CI).
- No inventes funcionalidad fuera de alcance (nada de facturación real, portabilidad, UI, push).

## Los prompts
Los 6 prompts numerados de `prompts/` son el guion exacto. Úsalos en orden. **Los prompts 2 y 4
devuelven borradores con errores a propósito** — cazarlos es parte de la lección.
