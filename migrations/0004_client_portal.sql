ALTER TABLE proposals ADD COLUMN client_message TEXT NOT NULL DEFAULT '';
ALTER TABLE proposals ADD COLUMN last_client_access_at TEXT;
ALTER TABLE proposals ADD COLUMN client_access_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_proposals_updated_at ON proposals(updated_at DESC);
