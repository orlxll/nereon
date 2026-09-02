CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_plans (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  workflow TEXT NOT NULL,
  assessment TEXT NOT NULL DEFAULT '',
  signal TEXT NOT NULL DEFAULT '',
  score INTEGER,
  blueprint_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_plans_lead_id ON automation_plans(lead_id);
