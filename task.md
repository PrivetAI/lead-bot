Lead Processing System - Архитектура (Обновленная)
Компоненты системы
1. n8n Workflow Engine
* Роль: Главный оркестратор с встроенным AI и Calendar API
* Порт: 5678
* Функции:
   * Прием webhook от amoCRM
   * Встроенные AI-ноды (OpenAI/Claude)
   * LLM классификация и sales-диалоги
   * Прямые HTTP запросы к Google Calendar API
   * Координация всех процессов
2. Node.js API Server
* Роль: Интеграции и вспомогательная логика
* Порт: 3000
* Эндпоинты:
   * POST /telegram/userbot - управление userbot
   * POST /amocrm/update - обновление лидов
   * GET /conversation/:leadId - история переписки
3. PostgreSQL Database
* Роль: Хранение данных
* Порт: 5432
* Таблицы:
   * leads - данные лидов
   * conversations - история переписки
   * calendar_events - события календаря
4. Redis Cache
* Роль: Кэш и сессии
* Порт: 6379
* Использование:
   * Состояние n8n workflow
   * Кэш Google Calendar ответов
   * Rate limiting
Структура каталогов

lead-processing-system/
├── docker-compose.yml
├── n8n/
│   ├── workflows/
│   │   └── lead-processing.json
│   ├── credentials/
│   │   └── google-calendar-oauth.json
│   └── nodes/
│       └── calendar-helpers.js
├── api/
│   ├── src/
│   │   ├── telegram/
│   │   ├── amocrm/
│   │   └── database/
│   ├── package.json
│   └── Dockerfile
├── db/
│   ├── init.sql
│   └── migrations/
└── docs/
    ├── prompts-classifier.md
    ├── prompts-sales.md
    └── google-calendar-integration.md
Поток данных

amoCRM → n8n webhook → n8n AI nodes (LLM) → PostgreSQL
                    ↓
              API Telegram → n8n AI classifier → n8n AI sales
                    ↓                              ↓
              PostgreSQL ← Google Calendar API ← n8n HTTP Request
                    ↓
              amoCRM update ← API Server ← n8n
Переменные окружения

# API
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=leads_db
REDIS_HOST=redis

# Integrations (mock)
AMOCRM_API_KEY=mock_key_123
TELEGRAM_BOT_TOKEN=mock_bot_456
OPENAI_API_KEY=mock_openai_789

# Google Calendar (встроено в n8n)
GOOGLE_CALENDAR_EMAIL=seller@company.com
GOOGLE_CLIENT_ID=mock_client_id
GOOGLE_CLIENT_SECRET=mock_secret
GOOGLE_REFRESH_TOKEN=mock_refresh

# n8n
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=password123
N8N_AI_OPENAI_API_KEY=mock_openai_789