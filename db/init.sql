-- Create databases
CREATE DATABASE n8n;
CREATE DATABASE leads_db;

-- Create users
CREATE USER n8n WITH PASSWORD 'n8n123';
CREATE USER leads_user WITH PASSWORD 'leads123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;
GRANT ALL PRIVILEGES ON DATABASE leads_db TO leads_user;

-- Switch to leads_db
\c leads_db;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO leads_user;

-- Leads table
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    amocrm_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'новый',
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    message_type VARCHAR(20) NOT NULL, -- 'incoming', 'outgoing'
    content TEXT NOT NULL,
    telegram_message_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar events table
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    google_event_id VARCHAR(255) UNIQUE,
    title VARCHAR(255),
    description TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_leads_amocrm_id ON leads(amocrm_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_calendar_events_lead_id ON calendar_events(lead_id);

-- Insert mock data
INSERT INTO leads (amocrm_id, name, phone, email, status, source) VALUES
(1001, 'Иван Петров', '+66812345678', 'ivan@example.com', 'новый', 'Instagram'),
(1002, 'Maria Garcia', '+66823456789', 'maria@example.com', 'в работе', 'Facebook'),
(1003, 'John Smith', '+66834567890', 'john@example.com', 'назначена встреча', 'Website');

-- Set owner
ALTER TABLE leads OWNER TO leads_user;
ALTER TABLE conversations OWNER TO leads_user;
ALTER TABLE calendar_events OWNER TO leads_user;