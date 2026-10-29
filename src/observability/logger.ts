// src/observability/logger.ts — logs estructurados sin PII (INV-7, NFR-AUDIT-001).
// Solo identificadores opacos (customer_id: c-721). Un campo prohibido o un valor con forma de
// PII LANZA error: el control es un gate, no una promesa.

const FORBIDDEN_KEYS = new Set([
  'name',
  'nombre',
  'phone',
  'telefono',
  'teléfono',
  'document',
  'documento',
  'dni',
  'email',
  'description',
  'descripcion',
  'descripción',
]);

const PII_PATTERNS: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /\+?\d[\d\s-]{7,}\d/, // teléfono o documento (8+ dígitos)
];

export type LogSink = (line: string) => void;

let sink: LogSink = (line) => process.stdout.write(`${line}\n`);

export function setLogSink(next: LogSink): void {
  sink = next;
}

export function resetLogSink(): void {
  sink = (line) => process.stdout.write(`${line}\n`);
}

export function assertNoPii(fields: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new Error(`Campo prohibido en logs (PII): ${key}`);
    }
    if (typeof value === 'string' && PII_PATTERNS.some((p) => p.test(value))) {
      throw new Error(`Valor con forma de PII en el campo de log: ${key}`);
    }
  }
}

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  assertNoPii(fields);
  sink(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }));
}
