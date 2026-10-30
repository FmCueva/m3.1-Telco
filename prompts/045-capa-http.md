# Prompt — Capa HTTP del API (Fastify + OpenAPI + store)

> Uso en el vídeo: capítulo 5, **entre** el TDD del dominio (prompt anterior) y los tests de
> contrato (prompt siguiente). El dominio ya está en verde; ahora lo exponemos por HTTP.
> La IA escribe la capa; **tú decides** el shape de errores y qué invariante protege cada endpoint.

## Punto de partida
Ya tienes en verde `src/domain/` (`types.ts` + `serviceTransitions.ts` con la función
`transition()`). Ahora construyes la capa HTTP que traduce ese dominio a un API **sin meter
reglas nuevas**: las reglas viven en el dominio; aquí solo se aplican y se mapean a códigos HTTP.

## Paso 1 — El store en memoria
```
Escribe src/api/store.ts: una clase InMemoryStore que guarde customers, contracts e incidents
en Maps, con métodos get/save por entidad. Es una "DB" que nace y muere con el proceso
(suficiente para la demo y para los tests de contrato: cero servicios externos). Sin IO ni
dependencias externas. (El Postgres del docker-compose y las migraciones SQL son material de CI,
no dependencia del runtime.)
```

## Paso 2 — La app Fastify
```
Lee specs/spec-servicio.md (sección "Contratos de los endpoints") y escribe src/api/app.ts:

- Exporta una función buildApp(): FastifyInstance que crea el servidor, crea un InMemoryStore
  nuevo y lo decora como app.store (los tests siembran estado por ahí).
- Valida los cuerpos con zod. Shape de error UNIFORME en todo el API: { code, message }.
- PROHIBIDO importar src/ai (frontera vigilada por dependency-cruiser): la clasificación con IA
  se integra en el cap. 7, no aquí; el server debe arrancar sin API key.
- El controller es FINO: parsea, llama al dominio/store, traduce el resultado o el error de
  dominio (p. ej. InvalidTransitionError → 409 con su code) a HTTP. Cero lógica de negocio aquí.
- Endpoints (con el invariante que protege cada uno):
  · GET  /healthz                → 200 { status: "ok" }
  · POST /customers              → alta (FR-CUST-001)
  · POST /customers/:id/kyc      → verificación KYC (FR-CUST-002)
  · GET  /customers/:id          → detalle + sus contratos (FR-CUST-003)
  · POST /contracts              → 403 KYC_REQUIRED si el cliente no tiene KYC (INV-4);
                                    409 DEBT_OUTSTANDING si deuda > 0 (INV-8); si vale, 201 en DRAFT.
  · GET  /contracts/:id          → detalle
  · POST /contracts/:id/events   → aplica transition(); 409 INVALID_TRANSITION si la transición no
                                    está en la tabla (INV-2) o el servicio está CANCELLED (INV-3);
                                    si es inválida, el estado NO cambia.
  · POST /incidents              → 404 si el servicio no existe; 409 SERVICE_CANCELLED si está CANCELLED (INV-9);
                                    si vale, incidencia en OPEN.
  · POST /incidents/:id/resolve  → resolución por el técnico (FR-INC-004).

Escribe también src/server.ts que arranque buildApp() en el puerto 8080 (lo usa el HEALTHCHECK
del Dockerfile).
```

## Paso 3 — El contrato OpenAPI
```
Escribe src/api/openapi.yaml (OpenAPI 3.1) que documente EXACTAMENTE los endpoints anteriores:
cada operación con su summary, request body y respuestas (incluidos los 4xx con el shape
{ code, message }). Es la "promesa" que protegerán los tests de contrato del prompt siguiente.
Documentación, no se sirve en runtime.
```

## Verificación
- `tsc`/`npm run build` compila; `src/api/app.ts` NO importa nada de `src/ai` (`npm run arch:check`).
- `buildApp()` arranca y `GET /healthz` responde 200.
- Con esto listo, el prompt de tests de contrato podrá `import { buildApp } from '../../src/api/app'`
  y usar `tests/helpers/testApp.ts` (helper de DB efímera que ya viene en el repo).
