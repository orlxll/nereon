ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN next_action_at TEXT;
ALTER TABLE leads ADD COLUMN last_contacted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads(next_action_at);
