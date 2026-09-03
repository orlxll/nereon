CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_acceptance',
  title TEXT NOT NULL,
  amount_eur REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  amount_eur REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending',
  due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'pending_provider',
  provider_payment_id TEXT,
  amount_eur REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
