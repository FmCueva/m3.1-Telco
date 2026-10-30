-- migrations/001_init.sql — esquema de customers, contracts, incidents y ai.
-- Idempotente (IF NOT EXISTS): migrate.ts la aplica entera en cada ejecución.
-- Los estados son CHECK sobre un conjunto cerrado, nunca booleanos (INV-1).

CREATE TABLE IF NOT EXISTS customers (
  id               TEXT PRIMARY KEY,
  kyc_status       TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (kyc_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  outstanding_debt NUMERIC NOT NULL DEFAULT 0 CHECK (outstanding_debt >= 0)
);

CREATE TABLE IF NOT EXISTS contracts (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  type        TEXT NOT NULL CHECK (type IN ('FIBER', 'MOBILE', 'PACK')),
  status      TEXT NOT NULL DEFAULT 'DRAFT'
              CHECK (status IN ('DRAFT', 'PENDING_INSTALLATION', 'ACTIVE', 'SUSPENDED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id                TEXT PRIMARY KEY,
  contract_id       TEXT NOT NULL REFERENCES contracts (id),
  description       TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('OPEN', 'MANUAL_REVIEW', 'RESOLVED')),
  manual_review_at  TIMESTAMPTZ,
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                   TEXT PRIMARY KEY,
  incident_id          TEXT NOT NULL REFERENCES incidents (id),
  category             TEXT NOT NULL,
  confidence           NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  suggested_resolution TEXT NOT NULL,
  model                TEXT NOT NULL
);

-- INV-6: una sola decisión humana por sugerencia, con técnico opaco y marca de tiempo.
CREATE TABLE IF NOT EXISTS suggestion_decisions (
  suggestion_id TEXT PRIMARY KEY REFERENCES ai_suggestions (id),
  technician_id TEXT NOT NULL,
  decision      TEXT NOT NULL CHECK (decision IN ('ACCEPTED', 'MODIFIED', 'REJECTED')),
  decided_at    TIMESTAMPTZ NOT NULL
);

-- NFR-AUDIT-001: solo identificadores opacos, nunca PII.
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  event         TEXT NOT NULL
                CHECK (event IN ('suggestion_created', 'suggestion_decision', 'incident_resolved')),
  suggestion_id TEXT,
  incident_id   TEXT,
  technician_id TEXT,
  decision      TEXT,
  model         TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_incidents_contract ON incidents (contract_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
