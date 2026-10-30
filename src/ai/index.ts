// API pública del módulo ai (ADR-001): lo demás se importa solo desde aquí.
export {
  classifyIncident,
  classifyUnlessDisabled,
  computeCostEur,
  CATEGORIES,
  MODEL,
} from './classifyIncident';
export type {
  ClassificationResult,
  IncidentSuggestion,
  MessagesClient,
} from './classifyIncident';
