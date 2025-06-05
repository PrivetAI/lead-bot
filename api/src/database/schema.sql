-- WhatsApp Sales Automation Database Schema
-- Версия: 1.0
-- Дата: 2025-06-06

-- ===============================================
-- ОСНОВНЫЕ ТАБЛИЦЫ
-- ===============================================

-- Таблица лидов
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    company_info TEXT,
    business_type VARCHAR(100),
    employees_count VARCHAR(50),
    has_crm VARCHAR(10),
    status VARCHAR(50) DEFAULT 'new',
    classification_status VARCHAR(50) DEFAULT 'pending',
    meeting_scheduled BOOLEAN DEFAULT FALSE,
    meeting_time TIMESTAMP,
    
    -- Результаты классификации
    company_size VARCHAR(50),
    estimated_budget VARCHAR(50),
    needs_description TEXT,
    urgency_level VARCHAR(20),
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица истории чата
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    ai_agent VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица логов AI ответов
CREATE TABLE IF NOT EXISTS ai_responses_log (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    input_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    ai_agent VARCHAR(20) NOT NULL CHECK (ai_agent IN ('classifier', 'sales')),
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица встреч
CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    google_calendar_event_id VARCHAR(255),
    meeting_time TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    meeting_link VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица системных настроек
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ===============================================

-- Индексы для таблицы leads
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_classification_status ON leads(classification_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_meeting_scheduled ON leads(meeting_scheduled);

-- Индексы для таблицы chat_history
CREATE INDEX IF NOT EXISTS idx_chat_history_lead_id ON chat_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_phone ON chat_history(phone);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_history_direction ON chat_history(direction);

-- Индексы для таблицы ai_responses_log
CREATE INDEX IF NOT EXISTS idx_ai_responses_lead_id ON ai_responses_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_phone ON ai_responses_log(phone);
CREATE INDEX IF NOT EXISTS idx_ai_responses_agent ON ai_responses_log(ai_agent);
CREATE INDEX IF NOT EXISTS idx_ai_responses_created_at ON ai_responses_log(created_at);

-- Индексы для таблицы meetings
CREATE INDEX IF NOT EXISTS idx_meetings_lead_id ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(meeting_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- ===============================================
-- ТРИГГЕРЫ
-- ===============================================

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для обновления updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON leads
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at 
    BEFORE UPDATE ON meetings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ===============================================

-- Представление для аналитики лидов
CREATE OR REPLACE VIEW lead_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN classification_status = 'complete' THEN 1 END) as classified_leads,
    COUNT(CASE WHEN status = 'in_sales' THEN 1 END) as in_sales_leads,
    COUNT(CASE WHEN meeting_scheduled = true THEN 1 END) as meetings_scheduled,
    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_deals,
    ROUND(
        COUNT(CASE WHEN meeting_scheduled = true THEN 1 END)::numeric / 
        NULLIF(COUNT(CASE WHEN classification_status = 'complete' THEN 1 END), 0) * 100, 
        2
    ) as conversion_to_meeting_percent
FROM leads 
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Представление для статистики чатов
CREATE OR REPLACE VIEW chat_statistics AS
SELECT 
    l.id as lead_id,
    l.name,
    l.phone,
    l.status,
    COUNT(ch.id) as total_messages,
    COUNT(CASE WHEN ch.direction = 'incoming' THEN 1 END) as incoming_messages,
    COUNT(CASE WHEN ch.direction = 'outgoing' THEN 1 END) as outgoing_messages,
    MIN(ch.created_at) as first_message_time,
    MAX(ch.created_at) as last_message_time,
    EXTRACT(EPOCH FROM (MAX(ch.created_at) - MIN(ch.created_at)))/3600 as conversation_duration_hours
FROM leads l
LEFT JOIN chat_history ch ON l.id = ch.lead_id
GROUP BY l.id, l.name, l.phone, l.status;

-- Представление для воронки продаж
CREATE OR REPLACE VIEW sales_funnel AS
SELECT 
    'Всего лидов' as stage,
    COUNT(*) as count,
    100.0 as percentage,
    1 as stage_order
FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT 
    'Классифицированы' as stage,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') * 100, 2) as percentage,
    2 as stage_order
FROM leads 
WHERE classification_status = 'complete' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT 
    'В продажах' as stage,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') * 100, 2) as percentage,
    3 as stage_order
FROM leads 
WHERE status = 'in_sales' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT 
    'Встречи назначены' as stage,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') * 100, 2) as percentage,
    4 as stage_order
FROM leads 
WHERE meeting_scheduled = true 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT 
    'Сделки закрыты' as stage,
    COUNT(*) as count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') * 100, 2) as percentage,
    5 as stage_order
FROM leads 
WHERE status = 'closed' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'

ORDER BY stage_order;

-- ===============================================
-- НАЧАЛЬНЫЕ ДАННЫЕ
-- ===============================================

-- Системные настройки
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('whatsapp_welcome_template', 'Здравствуйте, {name}! 👋\n\nМеня зовут Анна, я ваш персональный помощник. Вижу, что вы оставили заявку на нашем сайте.\n\nРасскажите, пожалуйста, с какой задачей к нам обратились? Какой результат хотели бы получить?', 'Шаблон приветственного сообщения'),
('business_hours_start', '09:00', 'Начало рабочего дня'),
('business_hours_end', '18:00', 'Конец рабочего дня'),
('meeting_duration_minutes', '60', 'Длительность встречи по умолчанию'),
('max_classification_attempts', '5', 'Максимальное количество попыток классификации'),
('ai_classifier_prompt', 'Ты AI-классификатор для определения потребностей клиентов. Твоя задача через естественный диалог определить: 1. Размер компании клиента 2. Предполагаемый бюджет проекта 3. Потребности и ожидания от сотрудничества 4. Срочность решения задачи. Важно: НЕ используй анкеты и структурированные вопросы. Веди живое общение, но мягко направляй разговор к получению нужной информации.', 'Промпт для AI-классификатора'),
('ai_sales_prompt', 'Ты AI-продавец. Твоя задача - вести продажи и назначать встречи. У тебя есть вся информация о клиенте из предыдущего диалога. Фокусируйся на: 1. Презентации решений под потребности клиента 2. Работе с возражениями 3. Закрытии на встречу. Будь настойчивым, но тактичным.', 'Промпт для AI-продавца')
ON CONFLICT (setting_key) DO NOTHING;

-- ===============================================
-- ПОЛЕЗНЫЕ ФУНКЦИИ
-- ===============================================

-- Функция для получения следующего доступного времени встречи
CREATE OR REPLACE FUNCTION get_next_available_slot(
    start_date DATE DEFAULT CURRENT_DATE,
    duration_minutes INTEGER DEFAULT 60
) RETURNS TIMESTAMP AS $$
DECLARE
    business_start TIME := '09:00';
    business_end TIME := '18:00';
    current_slot TIMESTAMP;
    slot_end TIMESTAMP;
BEGIN
    -- Начинаем с завтрашнего дня если сегодня поздно
    IF EXTRACT(HOUR FROM CURRENT_TIME) >= 18 THEN
        start_date := start_date + INTERVAL '1 day';
    END IF;
    
    -- Пропускаем выходные
    WHILE EXTRACT(DOW FROM start_date) IN (0, 6) LOOP
        start_date := start_date + INTERVAL '1 day';
    END LOOP;
    
    -- Находим первый доступный слот
    current_slot := start_date + business_start;
    
    WHILE TRUE LOOP
        slot_end := current_slot + (duration_minutes || ' minutes')::INTERVAL;
        
        -- Проверяем, что слот в рабочих часах
        IF EXTRACT(HOUR FROM slot_end::TIME) <= 18 THEN
            -- Проверяем доступность слота
            IF NOT EXISTS(
                SELECT 1 FROM meetings 
                WHERE status = 'scheduled'
                AND meeting_time < slot_end
                AND meeting_time + (duration_minutes || ' minutes')::INTERVAL > current_slot
            ) THEN
                RETURN current_slot;
            END IF;
        ELSE
            -- Переходим на следующий день
            start_date := start_date + INTERVAL '1 day';
            WHILE EXTRACT(DOW FROM start_date) IN (0, 6) LOOP
                start_date := start_date + INTERVAL '1 day';
            END LOOP;
            current_slot := start_date + business_start;
            CONTINUE;
        END IF;
        
        -- Следующий слот через час
        current_slot := current_slot + INTERVAL '1 hour';
    END LOOP;
END;
$$ LANGUAGE plpgsql;