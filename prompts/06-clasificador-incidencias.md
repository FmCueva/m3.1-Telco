# Prompt 5 — Clasificador de incidencias con IA bajo control (pegar en Claude Code)

> Uso en el vídeo: capítulo 7.

```
Lee specs/srs-telco.md (FR-INC-002, FR-INC-003, NFR-COST-001, NFR-AUDIT-001) y
specs/spec-servicio.md (INV-6). Implementa src/ai/classifyIncident.ts con estas
reglas NO negociables:

1. Modelo: claude-haiku-4-5 (clasificación simple = modelo barato; presupuesto
   < 0,01 €/incidencia).
2. La función devuelve una sugerencia o 'manual_review'. NUNCA modifica la
   incidencia ni escribe en DB.
3. Salida del modelo validada con zod (category del enum, confidence 0..1,
   suggestedResolution ≤ 600 chars). JSON inválido → manual_review, no excepción.
4. confidence < 0.8 → manual_review.
5. Calcula el coste real en euros con response.usage y regístralo en la métrica
   ai_cost_per_incident.
6. El system prompt deja claro que un técnico humano revisará siempre la sugerencia.

Después escribe tests/unit/classifyIncident.test.ts mockeando el SDK de Anthropic:
JSON válido con confianza alta, confianza baja, JSON malformado, y categoría
fuera del enum.
```

## Presupuesto de tokens (defenderlo con números en cámara)

| Concepto | Valor |
|---|---|
| Tokens por incidencia | ~800 in / ~150 out |
| Precio Haiku (mock) | 0,92 €/Mtok in · 4,60 €/Mtok out |
| Coste por incidencia | ~0,0014 € ✓ (presupuesto: 0,01 €) |
| 10 000 incidencias/mes | ~14 €/mes |
| Mismo flujo con modelo grande | ~10× más — y la clasificación no mejora |

Punto didáctico: el modelo se elige desde el NFR, no desde el hype.
