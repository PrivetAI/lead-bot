CREATE DATABASE n8n;
CREATE DATABASE leads_db;

CREATE USER n8n WITH PASSWORD 'n8n123';
CREATE USER leads_user WITH PASSWORD 'leads123';

GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;
GRANT ALL PRIVILEGES ON DATABASE leads_db TO leads_user;

\c leads_db;
GRANT ALL ON SCHEMA public TO leads_user;
GRANT CREATE ON SCHEMA public TO leads_user;

CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    amocrm_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'новый',
    ai_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    direction VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leads_amocrm_id ON leads(amocrm_id);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);

ALTER TABLE leads OWNER TO leads_user;
ALTER TABLE conversations OWNER TO leads_user;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO leads_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO leads_user;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT EXECUTE ON FUNCTION update_updated_at_column() TO leads_user;