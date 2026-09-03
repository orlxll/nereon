-- NEREON Phase 126: commercial schema sync
-- Safe additive migration for existing production/test data.

ALTER TABLE contracts ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE contracts ADD COLUMN updated_at TEXT;

ALTER TABLE invoices ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_updated_at
ON contracts(updated_at);

CREATE INDEX IF NOT EXISTS idx_invoices_updated_at
ON invoices(updated_at);
