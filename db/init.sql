-- db/init.sql (обновленная версия)
CREATE DATABASE n8n;
CREATE DATABASE leads_db;

CREATE USER n8n WITH PASSWORD 'n8n123';
CREATE USER leads_user WITH PASSWORD 'leads123';

GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;
GRANT ALL PRIVILEGES ON DATABASE leads_db TO leads_user;

\c n8n;
GRANT ALL ON SCHEMA public TO n8n;
GRANT CREATE ON SCHEMA public TO n8n;
ALTER SCHEMA public OWNER TO n8n;
GRANT USAGE ON SCHEMA public TO n8n;
GRANT CREATE ON DATABASE n8n TO n8n;

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
    source VARCHAR(100),
    budget VARCHAR(100),
    product_interest TEXT,
    notes TEXT,
    ai_classification JSONB,
    ai_score INTEGER,
    pipeline_id INTEGER,
    stage_id INTEGER,
    responsible_user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    platform VARCHAR(20) DEFAULT 'telegram',
    direction VARCHAR(20) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    telegram_message_id INTEGER,
    telegram_chat_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Добавляем отсутствующую таблицу из workflow
CREATE TABLE agent_actions (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    action_type VARCHAR(100) NOT NULL,
    action_data JSONB,
    calendar_event_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leads_amocrm_id ON leads(amocrm_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_ai_score ON leads(ai_score);
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_platform ON conversations(platform);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_calendar_events_lead_id ON calendar_events(lead_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_agent_actions_lead_id ON agent_actions(lead_id);
CREATE INDEX idx_agent_actions_status ON agent_actions(status);

INSERT INTO leads (amocrm_id, name, phone, email, status, source, budget, product_interest, notes, pipeline_id, stage_id, responsible_user_id) VALUES
(1001, 'Иван Петров', '+66812345678', 'ivan@example.com', 'новый', 'Instagram', '50000-100000', 'CRM система', 'Интересуется автоматизацией продаж', 1, 142, 1),
(1002, 'Maria Garcia', '+66823456789', 'maria@example.com', 'в работе', 'Facebook', '100000-200000', 'Marketing automation', 'Нужна интеграция с существующими системами', 1, 143, 1),
(1003, 'John Smith', '+66834567890', 'john@example.com', 'назначена встреча', 'Website', '200000+', 'Enterprise CRM', 'Крупная компания, нужно индивидуальное решение', 1, 144, 1);

INSERT INTO conversations (lead_id, platform, direction, message_type, content, metadata, telegram_chat_id) VALUES
(1, 'telegram', 'incoming', 'text', 'Здравствуйте! Интересует ваша CRM система. Можете рассказать подробнее?', '{"chat_id": 123456789}', 123456789),
(1, 'telegram', 'outgoing', 'ai_response', 'Здравствуйте, Иван! Рад вашему интересу к нашей CRM системе. Она поможет автоматизировать ваши продажи и увеличить конверсию. Хотели бы назначить демонстрацию?', '{"chat_id": 123456789, "ai_generated": true}', 123456789),
(2, 'telegram', 'incoming', 'text', 'Hi! I need marketing automation solution for my business', '{"chat_id": 987654321}', 987654321),
(2, 'telegram', 'outgoing', 'ai_response', 'Hello Maria! Our marketing automation platform can definitely help streamline your campaigns. Would you like to schedule a demo to see how it works?', '{"chat_id": 987654321, "ai_generated": true}', 987654321);

ALTER TABLE leads OWNER TO leads_user;
ALTER TABLE conversations OWNER TO leads_user;
ALTER TABLE calendar_events OWNER TO leads_user;
ALTER TABLE agent_actions OWNER TO leads_user;

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