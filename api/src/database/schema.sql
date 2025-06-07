-- Упрощенная схема БД для WhatsApp Sales Automation

-- Таблица лидов
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    amocrm_id VARCHAR(255) UNIQUE NOT NULL,  -- Внешний ID из amoCRM
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    wa_id VARCHAR(50),  -- WhatsApp ID формата phone@c.us
    status VARCHAR(50) DEFAULT 'new',
    
    -- AI классификация (убраны ограничения)
    classification TEXT,  -- hot/warm/cold
    company_size TEXT,
    budget_range TEXT,
    needs TEXT,
    urgency TEXT,  -- Срочность решения задачи
    
    -- Дополнительная информация из amoCRM
    company_info TEXT,  -- JSON с информацией о компании
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица истории чата
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    ai_agent VARCHAR(20),  -- 'classifier' или 'sales' или NULL для человека
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_amocrm_id ON leads(amocrm_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_classification ON leads(classification);
CREATE INDEX IF NOT EXISTS idx_chat_lead_id ON chat_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_phone ON chat_history(phone);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_history(created_at);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON leads
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();