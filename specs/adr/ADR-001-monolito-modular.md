# ADR-001 - Monolito modular, no microservicios

**Estado:** Aceptada · **Fecha:** semana 1

## Decisión

Monolito modular en TypeScript: un proceso, módulos con fronteras explícitas (imports solo vía el `index.ts` público de cada módulo, regla verificada con dependency-cruiser en CI).

## Consecuencias

Si un módulo necesita escala aparte, la frontera ya existe.

Revisión: cuando haya > 6 módulos o > 8 personas.
