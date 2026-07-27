# Prompt 3 — Plan de construcción: fases → jobs → tareas (pegar en Claude Code)

> Uso en el vídeo: capítulo 4. La IA **redacta** el plan a partir de lo ya decidido;
> tú **revisas y decides** el orden, el camino crítico y los cortes. Los ADRs de
> arquitectura NO se generan aquí: esos los escribes tú a mano (`specs/adr/`).

```
Lee specs/srs-telco.md, specs/spec-servicio.md y specs/adr/*.md.
Genera plan/jobs.yaml con la plantilla de trabajos del Módulo de Construcción (vídeo 1).
NO te inventes nada: el plan se DERIVA de esos documentos.

Estructura (3 niveles: fases → trabajos → tareas):

- Una sola fase: MVP-TELCO (1 semana). Incluye `quality_gate_fase`.
- Descompón el MVP en JOBs, y cada JOB es un SLICE VERTICAL de punta a punta
  (p.ej. "alta de cliente funciona", NO "la capa de datos").
- Por cada JOB:
    id (JOB-00x), name, owner, priority
    requirements: IDs FR/NFR del SRS a los que traza el JOB.
      Regla dura: si un JOB no traza a ningún requisito, ese JOB no existe.
    dependencies: otros JOB-id.
    deliverables: archivos/endpoints concretos que entrega.
    acceptance: criterios VERIFICABLES (sin palabras vagas; cada línea, testeable).
- Ordena los JOBs y encadena las dependencies de modo que se lea un CAMINO CRÍTICO.
  El primer JOB debe ser un walking skeleton + CI. El JOB de IA (incidencias) va al final.
- Nivel 3 (tasks): desglosa en tareas de ~1-2 h SOLO el JOB que se implementa a
  continuación (el de la máquina de estados del servicio). Del resto, las tareas se
  detallan al ejecutar cada JOB, no ahora (planificar al detalle lo lejano es tiempo tirado).

NO escribas código. Solo el plan en plan/jobs.yaml.
```

Después, en el vídeo, **revisamos el borrador a mano**, JOB por JOB: ¿traza a requisitos
reales?, ¿el orden y las dependencias tienen sentido?, ¿los cortes son verticales?,
¿cada `acceptance` es comprobable? La IA propone; el ingeniero decide.
