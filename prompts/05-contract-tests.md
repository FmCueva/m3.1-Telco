# Prompt 4 — Tests de contrato del API (pegar en Claude Code)

> Uso en el vídeo: capítulo 5, sección final.

```
Lee specs/spec-servicio.md y la OpenAPI de src/api. Escribe
tests/contract/contracts.api.test.ts (vitest + app.inject de Fastify) que verifique
el CONTRATO HTTP, no la implementación:

- POST /contracts con cliente sin KYC → 403 con code KYC_REQUIRED (INV-1)
- POST /contracts con cliente con deuda → 409 DEBT_OUTSTANDING (INV-4)
- POST /contracts válido → 201 y status DRAFT
- POST /contracts/:id/events con transición inválida → 409 INVALID_TRANSITION
  y el estado NO cambia (verifícalo con un GET posterior)
- POST /contracts/:id/events sobre CANCELLED → 409 (INV-3)
- POST /incidents sobre servicio CANCELLED → 409 (INV-5)
- POST /incidents sobre servicio inexistente → 404

Usa los helpers de tests/helpers/testApp.ts (DB efímera). Un describe por endpoint.
```

## Punto didáctico para la narración

El unit test protege el dominio; el contract test protege la promesa hecha a
quien consume el API. Si mañana se refactoriza el dominio entero, el contract
test ni se toca: esa es la diferencia.
