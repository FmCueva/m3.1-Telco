// src/ai/classifyIncident.ts — clasificador de incidencias (FR-DOM-014, NFR-AI-001, INV-5, INV-6).
// SOLO clasifica y sugiere: no recibe repositorios ni escribe en ningún sitio. Un técnico humano
// revisa siempre la sugerencia.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { recordMetric } from '../observability/metrics';

export const MODEL = 'claude-haiku-4-5';
export const CONFIDENCE_THRESHOLD = 0.8;
export const COST_METRIC = 'ai_cost_per_incident_eur';

// Precio Haiku en €/Mtok (ops/presupuesto-operativo.md).
export const PRICE_IN_EUR_PER_MTOK = 0.92;
export const PRICE_OUT_EUR_PER_MTOK = 4.6;

export const CATEGORIES = [
  'NETWORK_OUTAGE',
  'SLOW_SPEED',
  'BILLING',
  'EQUIPMENT',
  'OTHER',
] as const;

const suggestionSchema = z.object({
  category: z.enum(CATEGORIES),
  confidence: z.number().min(0).max(1),
  suggestedResolution: z.string().max(600),
});

export type IncidentSuggestion = z.infer<typeof suggestionSchema>;

export type ManualReviewReason = 'low_confidence' | 'invalid_output' | 'ai_error';

export type ClassificationResult =
  | {
      kind: 'suggestion';
      suggestion: IncidentSuggestion;
      model: string;
      costEur: number;
    }
  | {
      kind: 'manual_review';
      reason: ManualReviewReason;
      model: string;
      costEur: number;
    };

// Subconjunto del SDK que usamos: facilita el mock en tests (0 tokens).
export interface MessagesClient {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Message>;
  };
}

const SYSTEM_PROMPT = `Eres un asistente que clasifica incidencias de una operadora de telecomunicaciones.
Un técnico humano revisará SIEMPRE tu sugerencia antes de aplicarla: tú no decides ni modificas nada.
Responde únicamente con un JSON con esta forma:
{"category": "${CATEGORIES.join('|')}", "confidence": <número entre 0 y 1>, "suggestedResolution": "<máx. 600 caracteres>"}
No incluyas texto fuera del JSON. Si no estás seguro, baja la confianza.
No inventes datos del cliente. No prometas plazos.`;

let defaultClient: MessagesClient | undefined;

// Lazy: el SDK solo se instancia (y exige API key) cuando se clasifica de verdad.
function getDefaultClient(): MessagesClient {
  defaultClient ??= new Anthropic();
  return defaultClient;
}

export function computeCostEur(usage: {
  input_tokens: number;
  output_tokens: number;
}): number {
  return (
    (usage.input_tokens * PRICE_IN_EUR_PER_MTOK +
      usage.output_tokens * PRICE_OUT_EUR_PER_MTOK) /
    1_000_000
  );
}

export async function classifyIncident(
  description: string,
  client?: MessagesClient,
): Promise<ClassificationResult> {
  let response: Anthropic.Message;
  try {
    response = await (client ?? getDefaultClient()).messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    });
  } catch {
    return { kind: 'manual_review', reason: 'ai_error', model: MODEL, costEur: 0 };
  }

  const costEur = computeCostEur(response.usage);
  recordMetric(COST_METRIC, costEur);

  const block = response.content.find((b) => b.type === 'text');
  const text = block && block.type === 'text' ? block.text : '';

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'manual_review', reason: 'invalid_output', model: MODEL, costEur };
  }
  const parsed = suggestionSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: 'manual_review', reason: 'invalid_output', model: MODEL, costEur };
  }
  if (parsed.data.confidence < CONFIDENCE_THRESHOLD) {
    return { kind: 'manual_review', reason: 'low_confidence', model: MODEL, costEur };
  }
  return { kind: 'suggestion', suggestion: parsed.data, model: MODEL, costEur };
}
