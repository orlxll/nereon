-- NEREON Phase 128: production hardening
ALTER TABLE leads ADD COLUMN environment TEXT NOT NULL DEFAULT 'test';
ALTER TABLE leads ADD COLUMN won_at TEXT;
ALTER TABLE proposals ADD COLUMN environment TEXT NOT NULL DEFAULT 'test';
ALTER TABLE contracts ADD COLUMN environment TEXT NOT NULL DEFAULT 'test';
ALTER TABLE invoices ADD COLUMN environment TEXT NOT NULL DEFAULT 'test';
ALTER TABLE invoices ADD COLUMN paid_at TEXT;
ALTER TABLE payments ADD COLUMN environment TEXT NOT NULL DEFAULT 'test';
ALTER TABLE payments ADD COLUMN paid_at TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_environment ON leads(environment);
CREATE INDEX IF NOT EXISTS idx_proposals_environment ON proposals(environment);
CREATE INDEX IF NOT EXISTS idx_contracts_environment ON contracts(environment);
CREATE INDEX IF NOT EXISTS idx_invoices_environment ON invoices(environment);
CREATE INDEX IF NOT EXISTS idx_payments_environment ON payments(environment);
