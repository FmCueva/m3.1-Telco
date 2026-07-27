# Prompt 1 — Borrador de SRS (pegar en Claude Code)

> Uso en el vídeo: capítulo 2. La IA genera el borrador; nosotros lo revisamos
> críticamente en pantalla. La IA redacta, el ingeniero decide.

```
Actúa como ingeniero de requisitos. Vamos a construir el backend de una operadora
de telecomunicaciones (proyecto formativo, alcance acotado).

Funcionalidad: alta de clientes con verificación de identidad (KYC), contratación
de servicios (FIBER, MOBILE, PACK), gestión del ciclo de vida del servicio
(borrador, pendiente de instalación, activo, suspendido por impago, cancelado),
y gestión básica de incidencias con clasificación asistida por IA bajo validación
humana.

Genera un borrador de SRS en markdown con EXACTAMENTE estas secciones:
1. Propósito y alcance (incluye qué queda FUERA de alcance)
2. Actores (tabla)
3. Requisitos funcionales: tabla con ID (formato FR-DOM-nnn), enunciado verificable
   y prioridad MoSCoW
4. Requisitos no funcionales: tabla con ID (NFR-XXX-nnn), enunciado MEDIBLE y
   método de verificación
5. Restricciones

Reglas:
- Cada requisito debe ser verificable: si no se puede testear, reescríbelo.
- No inventes funcionalidad que no te he pedido (nada de facturación real,
  portabilidad, UI).
- Máximo 14 FR y 5 NFR.
NO generes código. Solo el documento.
```

## Qué buscar en la revisión (para el vídeo)

- ¿Algún FR no verificable? ("el sistema será fácil de usar" → fuera)
- ¿Algún NFR sin número? ("respuesta rápida" → p95 < 200 ms)
- ¿Inventó alcance? (suele añadir facturación o notificaciones push → recortar)
- ¿Los webhooks de instalación/facturación están como actores? (suele olvidarlos)
