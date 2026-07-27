// .dependency-cruiser.cjs — fronteras de módulos del ADR-001, verificadas en CI.
// Invocación (job lint de ci.yml): npx depcruise src --validate
// Las fronteras son contratos internos: si un import las cruza, el pipeline rompe.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment:
        'ADR-002: el dominio es puro — sin IO, sin framework, sin conocer al resto de módulos.',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(api|ai|observability)' },
    },
    {
      name: 'domain-no-npm-deps',
      comment: 'ADR-002: el dominio no depende de ningún paquete externo.',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'] },
    },
    {
      name: 'ai-cannot-reach-api',
      comment: 'ADR-001: el módulo ai no conoce la capa HTTP.',
      severity: 'error',
      from: { path: '^src/ai' },
      to: { path: '^src/api' },
    },
    {
      name: 'api-cannot-reach-ai',
      comment:
        'classifyIncident instancia el SDK de Anthropic al cargar el módulo: si el API ' +
        'lo importara (directa o transitivamente), el server no arrancaría sin API key.',
      severity: 'error',
      from: { path: '^src/api' },
      to: { path: '^src/ai' },
    },
    {
      name: 'observability-is-a-leaf',
      comment:
        'ADR-001: observabilidad es una hoja — nadie depende de ella hacia arriba.',
      severity: 'error',
      from: { path: '^src/observability' },
      to: { path: '^src/(domain|api|ai)' },
    },
    {
      name: 'no-circular',
      comment: 'Los ciclos entre módulos disuelven las fronteras: prohibidos.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
