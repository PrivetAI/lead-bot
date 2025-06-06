-- Создание баз данных
CREATE DATABASE n8n;
CREATE DATABASE leads_db;

-- Создание пользователей
CREATE USER n8n WITH PASSWORD 'n8n123';
CREATE USER leads_user WITH PASSWORD 'leads123';

-- Права на базы данных
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;
GRANT ALL PRIVILEGES ON DATABASE leads_db TO leads_user;

-- Переключаемся на leads_db
\c leads_db;

-- Права на схему
GRANT ALL ON SCHEMA public TO leads_user;
GRANT CREATE ON SCHEMA public TO leads_user;

-- Таблица лидов
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    classification VARCHAR(20),
    company_size VARCHAR(50),
    budget_range VARCHAR(50),
    needs TEXT,
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
    ai_agent VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_lead_id ON chat_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_phone ON chat_history(phone);

-- Права доступа на таблицы
ALTER TABLE leads OWNER TO leads_user;
ALTER TABLE chat_history OWNER TO leads_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO leads_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO leads_user;

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$ language 'plpgsql';

-- Триггер
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON leads
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO leads_user;