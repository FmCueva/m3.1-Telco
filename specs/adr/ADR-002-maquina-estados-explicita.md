# ADR-002 - Máquina de estados explícita en el dominio

**Estado:** Aceptada · **Fecha:** semana 1

## Contexto

El borrador de IA modela el estado con booleanos (`isActive`, `isSuspended`): permite estados imposibles (`isActive && isSuspended`).

## Decisión

Union type cerrado + tabla única `VALID_TRANSITIONS`.

Toda transición pasa por una única función `transition()` (INV-2, INV-3).

Estados imposibles = no representables.
