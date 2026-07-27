# Prompt 3 — TDD de la máquina de estados (pegar en Claude Code)

> Uso en el vídeo: capítulo 5. Primero los tests (rojo), luego la implementación (verde).

## Paso 1 — Solo los tests

```
Lee specs/spec-servicio.md. Escribe SOLO el archivo
tests/unit/serviceTransitions.test.ts (vitest) para una función
transition(from: ServiceStatus, event: ServiceEvent): ServiceStatus
que aún no existe.

Debe cubrir:
1. Las 8 transiciones válidas de la spec, una a una (it.each).
2. INV-2 exhaustivo: las 25 combinaciones estado×evento; toda combinación fuera
   de la tabla lanza InvalidTransitionError (genera los casos con bucles, no a mano).
3. INV-3: CANCELLED + cada uno de los 5 eventos lanza InvalidTransitionError.

NO implementes transition. NO crees más archivos. Los tests deben fallar al compilar.
```

## Paso 2 — La implementación mínima

```
Ahora implementa src/domain/types.ts y src/domain/serviceTransitions.ts para que
los tests pasen, con estas restricciones:
- ServiceStatus y ServiceEvent como union types (ADR-002, nada de booleanos).
- La tabla VALID_TRANSITIONS como un único Record congelado: la spec literal.
- transition() es la única función que cambia estados; lanza InvalidTransitionError
  con código 'INVALID_TRANSITION'.
- Dominio puro: cero imports de framework, DB o HTTP.
Ejecuta npm run test:unit y enséñame el resultado.
```

## Verificación en cámara

`npm run test:unit` → 30 tests verdes (8 válidas + 17 inválidas + 5 de terminal).
Después: pedir a Claude Code que rellene `CANCELLED` con el mapa completo de los 5 eventos
y ver caer 10 tests (5 de INV-2 + 5 de INV-3). El test defiende el invariante, no la memoria del equipo.
