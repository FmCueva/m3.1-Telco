# Decisiones de diseño — TELCO

> Redactado con IA a partir de los datos del repo. Las dos decisiones y su defensa fueron revisadas
> y **aprobadas por el autor** (2026-10-29).

## Decisión 1 · Monolito modular, no microservicios (ADR-001)

**Ganamos** simplicidad operativa y presupuesto: un solo proceso y un solo despliegue. La
operación entera cuesta **~280 €/mes frente al tope de 300 €** del SRS, y el cómputo son solo
2 contenedores de 1 vCPU (~55 €, `ops/presupuesto-operativo.md`). No hay red entre módulos, y
la latencia queda muy por debajo del requisito: **p95 ~41 ms a 100 req/s frente a < 200 ms** (NFR-PERF-001).
Las fronteras no se pierden: **dependency-cruiser** vigila en CI que cada módulo se importe solo
por su `index.ts` (hoy: 16 módulos, 0 violaciones).

**A costa de** no poder escalar ni desplegar un módulo por separado, y de que las fronteras
dependan de que el gate de CI siga activo, no de una barrera física. Si `ai` necesitara escala
propia, hoy habría que extraerlo. Lo aceptamos porque la carga nominal es ~5 req/s. El ADR fija
cuándo revisarlo: **más de 6 módulos o más de 8 personas** (hoy: 4 módulos).

*Límite honesto:* no medimos una alternativa con microservicios; la comparación se apoya en el
presupuesto y en el tamaño del equipo, no en un experimento.

## Decisión 2 · IA pequeña (`haiku`) con umbral 0.8 y humano siempre en el circuito

**Ganamos** coste y control. Cada clasificación cuesta **~0,0014 €**, unas 7 veces menos que el
tope de 0,01 € por incidencia; con ~10 000 incidencias/mes son **~14 €/mes**, el 5 % del
presupuesto. La IA solo sugiere: nada se aplica sin la decisión de un técnico, que queda
registrada (INV-6). Si la confianza es menor de 0.8, o la salida no cumple el esquema `zod`, la
incidencia va a `MANUAL_REVIEW` en lugar de fallar. Eso se probó en el GameDay 01 con el
proveedor caído: **0 respuestas 5xx**, alerta en **< 2 min** y cola por debajo de 20 en
**14 min** tras activar el flag.

**A costa de** más trabajo humano: un modelo pequeño y un umbral prudente mandan más casos a la
cola manual. Lo acotamos con el **SLO-3**: el 95 % de la cola se resuelve en menos de 4 h.

*Límite honesto:* el 0.8 no está calibrado con datos reales; es un umbral prudente. Hay que
medir qué fracción cae en `MANUAL_REVIEW` y revisarlo con `ai_acceptance_rate`. El tope de
0,01 €/incidencia es un tope interno de operación (`ops/`), no un requisito del SRS; el SRS solo exige registrar el coste (NFR-AI-001).

## Qué hizo la IA y qué decidí yo

| La IA redactó (y se revisó) | Lo decidí yo |
|---|---|
| Borradores de SRS, spec y plan; tests y código; `FR-DOM-017` y `NFR-OPS-001` | ADR-001 y ADR-002; el umbral de 4 h al 95 % del SLO-3; aceptar o corregir cada requisito |
