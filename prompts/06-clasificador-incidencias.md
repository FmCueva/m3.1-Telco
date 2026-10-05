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

## Documento de riesgos de la IA (entregable, redacción libre)

`specs/ethical-risk-assessment.md` es un entregable del proyecto: la evaluación de riesgos del uso
de IA (clasificación del tipo de uso + matriz de riesgos con sus controles, atados a INV-6 /
NFR-AUDIT-001 / NFR-SEC-001). **No hay prompt ni plantilla fija que lo genere**: lo redactas con tu
criterio a partir de los riesgos que ya estás mitigando en este clasificador. Se valora por
contenido, no por parecerse al de la solución de referencia.
