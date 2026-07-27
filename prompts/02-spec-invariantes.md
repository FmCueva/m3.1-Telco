# Prompt 2 — Spec: máquina de estados + invariantes (pegar en Claude Code)

> Uso en el vídeo: capítulo 3. IMPORTANTE: el borrador que devuelva tendrá errores.
> Eso es parte de la lección: la spec la valida el humano contra el negocio.

```
Lee specs/srs-telco.md. A partir de los FR-CONT-001..006 y FR-INC-001..004,
genera specs/spec-servicio.md con:

1. La máquina de estados del servicio: estados, eventos y tabla de transiciones
   válidas (desde, evento, hacia). Toda transición fuera de la tabla debe
   declararse inválida con respuesta 409.
2. Una tabla de invariantes del dominio con ID (INV-n), enunciado y cómo se
   verifica cada uno (unit test, contract test, métrica).
3. Criterios de aceptación en Gherkin para: activación tras instalación,
   estado terminal, contratación sin KYC, clasificación IA con confianza baja,
   y registro de decisión humana.

Reglas:
- El estado se modela como enum/union type, NUNCA como booleanos.
- CANCELLED es terminal.
- La IA solo clasifica y sugiere: ningún escenario donde la IA modifique datos.
```

## Errores típicos del borrador (cazarlos en cámara)

1. Inventa la transición `SUSPENDED → PENDING_INSTALLATION` ("reinstalación") — no existe en el negocio.
2. Aunque se lo prohíbes, a veces modela con `isActive/isSuspended` — estados imposibles.
3. Trata `cancel` sobre `CANCELLED` como no-op silencioso — debe ser 409 (INV-3).

Guion de la corrección: se le responde en Claude Code:
```
Revisión: la transición SUSPENDED → PENDING_INSTALLATION no existe en este negocio,
elimínala. Y cancel sobre CANCELLED debe ser una transición inválida (409),
no un no-op. Regenera solo la tabla de transiciones y el Gherkin afectado.
```
