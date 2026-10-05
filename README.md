# Proyecto 1 — TELCO · Backend de operadora (Bloque III · SDD)

Backend de una operadora de telecomunicaciones: alta de clientes, contratación de servicios
(fibra, móvil, packs), gestión del estado del servicio e incidencias, con **IA bajo validación
humana**. Construido siguiendo **Spec-Driven Development (SDD)**.

> **La regla del bloque: sin especificación validada → no se implementa código.**

**Este repo es tu punto de partida.** Trae ya montada toda la **infraestructura** (CI, Docker,
observabilidad, scripts de gate y configuración); tú vas **construyendo el dominio** —la
especificación, el código y los tests— paso a paso siguiendo los 8 vídeos y usando los prompts de
[`prompts/`](./prompts/). Al terminar tendrás algo que vale más que este código: **el método**, que
transfieres a cualquier dominio (una telco, un banco, un hospital).

> 📦 **Qué ya viene** (infra: la lees, la copias, la adaptas): `prompts/`, `.github/workflows/`,
> `Dockerfile`, `docker-compose.yml`, `ops/`, `scripts/` y la config (`tsconfig`, `eslint`,
> `vitest`, `dependency-cruiser`, `package.json`).
> 🛠️ **Qué construyes tú** (con los prompts y tu criterio): `specs/` (SRS · spec · ADRs),
> `plan/jobs.yaml`, `src/`, `tests/` y `migrations/`.
>
> ¿Quieres ver la **solución de referencia completa**? Está en
> [`miseia/m3.1-Telco`](https://gitlab.codecrypto.academy/miseia/m3.1-Telco) — úsala para **comparar
> al final**, no para copiar mientras avanzas.

---

## Tabla de contenidos

- [🎓 Replica el proyecto paso a paso](#-replica-el-proyecto-paso-a-paso)
  - [Antes de empezar](#antes-de-empezar-prerequisitos)
  - [El punto de partida: los requisitos iniciales](#el-punto-de-partida-los-requisitos-iniciales)
  - [El método en una frase](#el-método-en-una-frase-quién-hace-qué)
  - [Los 6 prompts, en orden](#los-6-prompts-en-orden)
- [🎬 Qué se espera de ti en cada vídeo](#-qué-se-espera-de-ti-en-cada-vídeo)
- [📁 Qué hay en cada carpeta](#-qué-hay-en-cada-carpeta)
- [Tu entrega (encargo)](#tu-entrega-encargo)
- [Inicio rápido (para ejecutar la solución)](#inicio-rápido-para-ejecutar-la-solución)
- [Comandos · Stack · Requisitos](#comandos)

---

## 🎓 Replica el proyecto paso a paso

### Antes de empezar (prerequisitos)

| Necesitas | Para qué |
|---|---|
| **Node 22** (mín. 20) | ejecutar y testear el backend |
| **Docker** + Compose | levantar el entorno completo (api · db · otel · jaeger · prometheus) |
| **Claude Code** | pegar los prompts y generar los artefactos |
| **`gh` (GitHub CLI)** | crear el repo y ver el pipeline bloquear un PR (cap. 6) |
| **Anthropic API key** | **solo** para el capítulo 7 (clasificador IA). El resto funciona sin ella |

Clónate este repo (es tu andamiaje) e instala el toolchain:

```bash
git clone <URL-de-este-repo> mi-telco && cd mi-telco
npm ci                 # instala el toolchain (Node 22); aún no hay código de dominio
```

A partir de aquí **no escribes código todavía**: empiezas por la especificación (prompt 1).

### El punto de partida: los requisitos iniciales

Todo arranca de un encargo en lenguaje natural. Este es el punto de partida del proyecto (es lo
que va dentro del **prompt 1**), y es lo único que "te dan" — el resto lo derivas tú con el método:

> Construir el **backend de una operadora de telecomunicaciones** (proyecto formativo, alcance acotado).
>
> **Funcionalidad:**
> - Alta de clientes con verificación de identidad (**KYC**).
> - Contratación de servicios: **FIBER, MOBILE, PACK**.
> - Gestión del **ciclo de vida del servicio**: borrador → pendiente de instalación → activo →
>   suspendido por impago → cancelado.
> - Gestión básica de **incidencias**, con clasificación asistida por **IA bajo validación humana**.
>
> **Fuera de alcance:** facturación real, portabilidad, UI, notificaciones push.

Si vas a hacer **tu propio proyecto en otro dominio**, sustituye este párrafo por tu encargo
(reservas de hotel, historias clínicas, préstamos…) y sigue exactamente los mismos pasos.

### El método en una frase (quién hace qué)

El vídeo intercala, a propósito, generación con IA y decisiones humanas. Interioriza este reparto,
porque es el corazón del método:

| La **IA genera** (y tú revisas) | El **humano decide** (a mano) | La **infra se hereda** (del repo, se adapta) |
|---|---|---|
| SRS, spec, plan, tests, código de la feature | ADRs (arquitectura), SLOs, runbook, postmortem | CI (`ci.yml`), Docker, observabilidad, compose |

> **La IA redacta, el ingeniero decide.** Nada de lo que genera la IA entra sin revisión humana, y
> las decisiones (qué arquitectura, qué SLO, qué es "hecho") no se delegan.

### Los 6 prompts, en orden

Todos los prompts que se pegan en Claude Code están en [`prompts/`](./prompts/), **numerados en el
orden exacto de uso**:

| Paso | Prompt | Vídeo | Qué produce |
|------|--------|-------|-------------|
| 1 | [`01-srs-draft.md`](./prompts/01-srs-draft.md) | Cap. 2 | Borrador de SRS → `specs/srs-telco.md` |
| 2 | [`02-spec-invariantes.md`](./prompts/02-spec-invariantes.md) | Cap. 3 | Spec + invariantes + máquina de estados → `specs/spec-servicio.md` |
| 3 | [`03-plan-jobs.md`](./prompts/03-plan-jobs.md) | Cap. 4 | Plan de construcción (fases → jobs → tareas) → `plan/jobs.yaml` |
| 4 | [`04-tdd-transiciones.md`](./prompts/04-tdd-transiciones.md) | Cap. 5 | Tests primero (rojo) → implementación (verde) |
| 4b | [`045-capa-http.md`](./prompts/045-capa-http.md) | Cap. 5 | Capa HTTP: Fastify + OpenAPI + store |
| 5 | [`05-contract-tests.md`](./prompts/05-contract-tests.md) | Cap. 5 | Tests de contrato del API |
| 6 | [`06-clasificador-incidencias.md`](./prompts/06-clasificador-incidencias.md) | Cap. 7 | Clasificador IA bajo control + presupuesto de tokens |

⚠️ **Los prompts 2 y 4 devuelven borradores con errores a propósito.** Cazarlos es parte de la
lección: la especificación y los tests los valida el humano contra el negocio.

---

## 🎬 Qué se espera de ti en cada vídeo

Cada capítulo produce **un artefacto** y te deja **una habilidad**. No pases al siguiente sin tener
el artefacto en verde.

### Cap. 1 — Apertura y mapa del proyecto
- **Qué haces:** nada de código. Entiendes el dominio (el encargo de arriba) y el mapa del método.
- **Te llevas:** por qué "sin spec validada no hay código", y qué vas a construir de punta a punta.

### Cap. 2 — Requirements Engineering → `specs/srs-telco.md`
- **Qué haces:** pegas el **prompt 1**. La IA redacta un borrador de SRS (requisitos funcionales
  `FR-DOM-nnn` y no funcionales `NFR-XXX-nnn`). **Lo revisas críticamente en pantalla.**
- **Qué cazar:** requisitos no verificables ("fácil de usar" → fuera), NFR sin número ("rápido" →
  `p95 < 200 ms`), alcance inventado (facturación, push → recortar), actores olvidados (los webhooks
  de instalación/facturación).
- **Artefacto:** `specs/srs-telco.md` (máx. 14 FR + 5 NFR, todos verificables).

### Cap. 3 — La spec: invariantes y criterios de aceptación → `specs/spec-servicio.md`
- **Qué haces:** pegas el **prompt 2**. Genera la **máquina de estados** del servicio, la tabla de
  **invariantes** (`INV-n`) y los criterios de aceptación en **Gherkin**.
- **Qué cazar (hay errores a propósito):** el borrador suele modelar el estado con **booleanos**
  (`isActive`, `isSuspended`) → permite estados imposibles. La decisión correcta es un **tipo cerrado
  (union type) + tabla de transiciones**. `CANCELLED` es terminal.
- **Artefacto:** `specs/spec-servicio.md` + `specs/ethical-risk-assessment.md` (riesgos de la IA).
  El doc de riesgos es de **redacción libre** (no hay plantilla ni prompt que lo genere): se valora
  por contenido —clasificación del uso de IA + controles atados a INV-6 / NFR-AUDIT-001 / NFR-SEC-001—,
  no por parecerse a la versión de la solución.

### Cap. 4 — Arquitectura derivada y plan de construcción → `specs/adr/` + `plan/jobs.yaml`
- **Qué haces (a mano):** escribes los **ADR** — decisiones de arquitectura. *"¿Qué requisito te
  obliga a esto?"* Aquí NO usas prompt: la arquitectura es una decisión humana.
  - `ADR-001` monolito modular (no microservicios).
  - `ADR-002` máquina de estados explícita (la del cap. 3).
- **Qué haces (con IA):** pegas el **prompt 3**. La IA **deriva** el plan del SRS + los ADR:
  1 fase → JOBs (slices verticales que trazan a requisitos) → tareas. **Lo revisas JOB por JOB.**
- **Artefacto:** `specs/adr/*.md` + `plan/jobs.yaml` (con camino crítico).

### Cap. 5 — Implementación verificable → `src/domain/` + `src/api/` + `tests/`
- **Qué haces:** pegas el **prompt 4** (TDD): primero **los tests (en rojo)**, luego la
  **implementación mínima (a verde)**. Después el **prompt 5**: tests de contrato del API.
- **Qué cazar:** que los tests tracen a la spec (`@AC-TELCO-nnn`); el test exhaustivo de las 25
  combinaciones estado×evento (8 válidas, 17 → 409).
- **Artefacto:** `src/domain/serviceTransitions.ts`, `src/api/`, y `tests/unit` + `tests/contract`
  en verde.

### Cap. 6 — Pipeline de CI que bloquea → `.gitlab-ci.yml` (GitLab) · `.github/workflows/ci.yml` · `Dockerfile`
- **Qué haces:** el CI es **infraestructura**: lo **coges del repo y lo adaptas** (no hay prompt de
  CI). Lees el pipeline gate por gate: lint, complejidad, `npm audit`, **dependency-cruiser**
  (la "policía" del ADR-001), cobertura ≥ 80 %, DoD.
- **Dónde corre de verdad:** el campus usa **GitLab**, no GitHub Actions. Tienes un `.gitlab-ci.yml`
  de partida equivalente, adaptado al runner del campus (`cloudrun-ephemeral`): executor *shell* con
  Node 22 y **sin Docker ni `services:`**, así que PostgreSQL se instala dentro del job y todos los
  jobs llevan el tag `cloudrun`. El job `docker` queda en aviso (`allow_failure`) mientras no haya
  runner con Docker/buildah — **no penaliza**.
- **Nota de tamaño:** el gate de la imagen es **≤ 250 MB** (la base `node:22-alpine` ya pesa ~162 MB
  sin comprimir, así que bajar de 100 MB con Node no es posible).
- **Lo que sí es tuyo, a mano:** los scripts de gate (`scripts/coverage-gate.ts`, `check-dod.ts`).
- **La demo clave:** abres un PR que viola un invariante → **el pipeline bloquea el merge**. El "no"
  de la máquina no se negocia en una reunión.
- **Artefacto:** pipeline en verde + un PR bloqueado como prueba.

### Cap. 7 — IA integrada bajo control → `src/ai/classifyIncident.ts`
- **Qué haces:** aquí **sí** implementas una feature nueva con IA. Pegas el **prompt 6**, que lleva
  dentro las **6 reglas no negociables** del clasificador (modelo `haiku`, nunca modifica datos,
  salida validada con `zod`, `confidence < 0.8` → cola humana, coste como métrica, y el system prompt
  avisa al modelo de que un humano revisará).
- **Qué cazar:** que los tests corran con el SDK **mockeado** (0 tokens), que la lógica de control
  (las puertas) sea testeable gratis.
- **Artefacto:** `src/ai/classifyIncident.ts` + su test + `ops/presupuesto-operativo.md`.

### Cap. 8 — Observabilidad, operación y cierre → `src/observability/` + `ops/`
- **Qué haces:** conectas **OpenTelemetry** (trazas → Jaeger, métricas → Prometheus). Defines **2
  SLOs derivados de la spec** (a mano), sus **alertas** con `runbook_url`, y el **runbook**. Cierras
  con un **gameday** (inyectas un fallo, salta la alerta, aplicas el runbook) y su **postmortem**.
- **Reparto:** el código y la config de observabilidad se heredan del repo; los **SLOs, el runbook y
  el postmortem los escribes tú** (criterio humano, como los ADR).
- **Artefacto:** `src/observability/*`, `ops/slos.md`, `ops/alerts.yml`,
  `ops/runbook-cola-incidencias.md`, `ops/postmortem-gameday-01.md`.

---

## 📁 Qué hay en cada carpeta

El orden de las carpetas es el orden del método: cada etapa alimenta a la siguiente. Este es el mapa
del proyecto **terminado**: 📦 = ya viene en este repo (infra); 🛠️ = lo creas tú al avanzar.

```
├── prompts/               📦  Los 6 prompts para Claude Code, en orden de uso ← EMPIEZA AQUÍ
│
├── specs/                 🛠️  1 · La especificación (la fuente de verdad)
│   ├── srs-telco.md            #    SRS: requisitos FR/NFR verificables            (cap. 2)
│   ├── spec-servicio.md        #    Máquina de estados + invariantes + Gherkin     (cap. 3)
│   ├── ethical-risk-assessment.md   # Riesgos de la IA → requisitos                (cap. 3)
│   └── adr/                    #    Decisiones de arquitectura (a mano)            (cap. 4)
│       ├── ADR-001-monolito-modular.md
│       └── ADR-002-maquina-estados-explicita.md
│
├── plan/jobs.yaml              2 · Plan de construcción: fases → JOBs → tareas     (cap. 4)
│
├── migrations/                 3 · Esquema SQL (customers, contracts, incidents, ai)
│
├── src/                        4 · Implementación verificable (TypeScript, ESM)
│   ├── domain/                 #    Dominio PURO, sin IO (tipos + máquina de estados) (cap. 5)
│   ├── api/                    #    Fastify + contrato OpenAPI + store              (cap. 5)
│   ├── ai/                     #    Clasificador de incidencias, bajo control       (cap. 7)
│   ├── observability/          #    Logger, métricas, tracing, setup (OTel)         (cap. 8)
│   └── server.ts               #    Punto de entrada
│
├── tests/                      #    unit · contract · e2e · helpers                 (cap. 5)
│
├── scripts/                    #    DoD ejecutable, gate de cobertura, migraciones, load-test
│
├── .gitlab-ci.yml              #    Pipeline en GitLab (donde corre de verdad, cloudrun)   (cap. 6)
├── .github/workflows/          5 · Infra de CI (referencia de gates; GitHub Actions)  (cap. 6)
│   ├── ci.yml                  #    El pipeline que BLOQUEA merges incorrectos
│   └── nightly-load.yml        #    Prueba de carga nocturna
│
├── Dockerfile                  #    Imagen que cumple su spec (no-root, healthcheck, <=250 MB)
├── docker-compose.yml          #    api · postgres · otel · jaeger · prometheus
│
└── ops/                        6 · Observabilidad y operación                       (cap. 8)
    ├── slos.md                 #    SLOs con SLI good/valid (a mano)
    ├── alerts.yml              #    Alertas con runbook_url
    ├── prometheus.yml · otel.yaml
    ├── runbook-cola-incidencias.md
    ├── gameday-01-proveedor-ia.md
    ├── postmortem-gameday-01.md
    └── presupuesto-operativo.md
```

**Principio de diseño:** el dominio (`src/domain/`) es puro y sin efectos; la máquina de estados es
explícita y sus transiciones están cubiertas por tests **antes** de existir el código
([`ADR-002`](./specs/adr/ADR-002-maquina-estados-explicita.md)). La arquitectura es un monolito
modular con fronteras verificadas en CI ([`ADR-001`](./specs/adr/ADR-001-monolito-modular.md)).

---

## Tu entrega (encargo)

1. **Parte guiada** — reproducir el proyecto completo con los prompts numerados (los 8 vídeos).
2. **Tres extensiones sin guía** — rúbrica por extensión: *test + contrato verificado + trazabilidad
   al requisito*:
   - Persistir la decisión del técnico sobre la sugerencia (`AC-TELCO-005`, `INV-6`).
   - Cierre de incidencias de punta a punta, con su contrato.
   - SLO de la cola `MANUAL_REVIEW`: indicador, umbral, alerta y runbook.
3. **README de una página** defendiendo 2 decisiones propias con datos (*"ganamos X a costa de Y"*).

**Esfuerzo orientativo:** 8–12 h · **Gate de entrega:** pipeline en verde.

---

## Inicio rápido

**Ahora mismo** (repo recién clonado):

```bash
npm ci                                   # instala el toolchain (Node 22)
```

Y a partir de ahí, empieza por el **prompt 1**. Los comandos de abajo (`npm test`, `docker compose up`)
funcionarán **a medida que vayas construyendo** el código y los tests:

```bash
npm test                                 # unit + contract + e2e (una vez existan)
docker compose up                        # api + postgres + otel + jaeger + prometheus
```

Cuando la API esté implementada, queda escuchando en `http://localhost:8080` y su contrato OpenAPI
vive en `src/api/openapi.yaml` (lo generas tú en el cap. 5).

---

## Comandos

```bash
# Tests
npm test                 # suite completa con cobertura (unit + contract + e2e)
npm run test:unit        # solo unit
npm run test:contract    # solo contract
npm run test:e2e         # solo e2e

# Calidad
npm run lint             # prettier --check + eslint
npm run build            # compilación TypeScript a dist/

# Datos y operación
npm run migrate                        # aplica migrations/ contra la base de datos
npx tsx scripts/check-dod.ts JOB-004   # Definition of Done ejecutable de un job
docker compose up                      # entorno completo local
```

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node 22 (TypeScript, ESM) |
| API | Fastify 5 + Zod (validación) + OpenAPI |
| Datos | PostgreSQL (`pg`) + migraciones SQL |
| IA | `@anthropic-ai/sdk` (clasificador bajo control) |
| Observabilidad | OpenTelemetry → Jaeger (trazas) + Prometheus (métricas) |
| Tests | Vitest + cobertura v8 |
| Calidad | ESLint + Prettier + dependency-cruiser |
| Empaquetado | Docker multi-stage (<=250 MB, no-root, healthcheck) |

## Requisitos

- **Node 22** (ver `engines` en `package.json`, mínimo Node 20).
- **Docker** + Docker Compose (para el entorno completo).
- **Anthropic API key** — *solo* para el capítulo 7 (clasificador IA).

> Los archivos `.env` y `.secrets/` incluidos son **valores dummy de demo** para que
> `docker compose` arranque en local. En un proyecto real **no se commitean**: los secretos viven en
> un gestor (Vault, SOPS, secrets del CI).

<!-- BEGIN cc:que-se-valora -->
¡Hola! Aquí te explico en qué nos fijamos cuando corregimos tu proyecto P1 - Telco, para que sepas qué aspectos son los más importantes.

## 📋 Qué se valora

Nos fijamos mucho en que hayas definido bien el problema antes de empezar a solucionarlo, eso es importante. Pero, lo que más pesa de todo, es que podamos seguir el hilo de tu solución desde el principio hasta el final, viendo cómo cada parte contribuye al objetivo. También es importante que se vea claramente qué partes ha generado la inteligencia artificial y cuáles has decidido tú como humano. Otro punto importante es que demuestres que entiendes bien el dominio del problema y que tus soluciones son coherentes. Además, valoramos bastante que hayas automatizado la verificación de tu trabajo y que tengas "gates" para asegurar la calidad. Por último, aunque con un peso menor, nos interesa ver tu vídeo explicando tu método y mostrando una demo de tu proyecto.

Recuerda que el detalle de lo que se pide está en el enunciado del proyecto, y la evaluación no penaliza por cosas que no se hayan solicitado allí.
<!-- END cc:que-se-valora -->
