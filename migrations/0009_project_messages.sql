CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_project_created ON messages(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_lead_created ON messages(lead_id, created_at);
