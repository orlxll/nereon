CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'onboarding',
  amount_eur REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  environment TEXT NOT NULL DEFAULT 'test',
  started_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_contract_id ON projects(contract_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo', position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_project_id ON onboarding_tasks(project_id);
