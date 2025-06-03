### Компоненты системы  
**n8n Workflow Engine**  
Роль: главный оркестратор с AI-узлами и интеграцией Google Calendar  
Порт: 5678  
Функции:  
– приём webhooks от amoCRM и от API Server (Telegram-уведомления)  
– AI-классификация (OpenAI/Claude) → генерация sales-диалогов  
– HTTP-запросы к Google Calendar API (создание/обновление событий)  
– координация записи в PostgreSQL и обновления лидов в amoCRM  
**Node.js Userbot**  
Роль: взаимодействие с Telegram (без Python)  
Библиотека: node-telegram-bot-api (или аналогичная JS-реализация)  
Функции:  
– отправка приветственного шаблона по команде из n8n (по Telegram-ID)  
– long-polling входящих личных сообщений и пересылка их в n8n через API Server  
**Node.js API Server**  
Роль: интеграция, маршрутизация, вспомогательная логика  
Порт: 3000  
Эндпоинты:  
– `POST /telegram/userbot/send_greeting` → получает userId и leadId, вызывает Userbot для отправки приветствия  
– `POST /telegram/userbot/receive_message` → сохраняет сообщение в conversations, находит leadId по telegramUserId и пересылает в n8n (`/webhook/telegram_incoming`)  
– `POST /amocrm/update` → сохраняет/обновляет лид в leads, пересылает данные в n8n (`/webhook/amocrm_lead`)  
– `GET /conversation/:leadId` → возвращает все сообщения из conversations по заданному leadId  
**PostgreSQL Database**  
Роль: хранение лидов, переписок, событий календаря  
Порт: 5432
Таблицы:  
– `leads` (lead_id, amocrm_id, name, status, telegram_user_id, created_at, updated_at)  
– `conversations` (msg_id, lead_id, telegram_user_id, message_text, timestamp, direction)  
– `calendar_events` (event_id, lead_id, google_event_id, start_time, end_time, created_at)  
**Redis Cache**  
Роль: кэширование состояния n8n-Workflow, ответов Google Calendar, rate limiting  
Порт: 6379  

### Структура каталогов  
```
.  
├── api  
│   ├── Dockerfile  
│   ├── package.json  
│   ├── package-lock.json  
│   ├── sessions  
│   └── src  
│       ├── amocrm  
│       ├── database  
│       └── telegram  
├── db  
│   ├── init.sql  
│   └── migrations  
├── docker-compose.yml  
├── docs  
│   ├── prompts-classifier.md  
│   └── prompts-sales.md  
├── n8n  
│   ├── credentials  
│   └── workflows  
│       └── lead-processing.json  
├── task.md  
└── wf.txt  
```

### docker-compose.yml (кратко)  
**postgres**  
– образ: `postgres:13`  
– монтирование `./db` → `/docker-entrypoint-initdb.d`  
– порты: `5432:5432`  
**redis**  
– образ: `redis:6`  
– порты: `6379:6379`  
**api**  
– сборка из `./api/Dockerfile`  
– переменные окружения из `.env`  
– зависимости: postgres, redis  
– порты: `3000:3000`  
– монтирование `./api/src/sessions` → `/app/sessions`  
**n8n**  
– образ: `n8nio/n8n:latest`  
– переменные окружения из `.env`  
– порты: `5678:5678`  
– монтирование `./n8n/credentials` → `/home/node/.n8n/credentials`  
– монтирование `./n8n/workflows` → `/home/node/.n8n/workflows`  
**userbot**  
– сборка также из `./api/Dockerfile` (тот же контейнер Node.js)  
– команда: `node src/telegram/index.js`  
– переменные окружения из `.env`  
– зависит от api  
– монтирование `./api/src/sessions` → `/app/sessions`  

### Краткая последовательность взаимодействия  
Новый лид в amoCRM  
→ webhook `POST /amocrm/update` (API Server)  
→ сохранение/обновление в БД (leads)  
→ `POST → n8n/webhook/amocrm_lead`  
n8n обработка  
→ AI-классификатор (OpenAI/Claude)  
→ создание/обновление события Google Calendar  
→ запись в `calendar_events`  
→ обновление статуса в amoCRM (через API Server)  
n8n инициирует отправку в Telegram  
→ `POST /telegram/userbot/send_greeting` (API Server)  
→ Userbot отправляет приветствие по Telegram  
Пользователь отвечает  
→ Userbot получает DM (long-polling)  
→ формирует JSON с telegramUserId, messageId, text, timestamp  
→ `POST /telegram/userbot/receive_message`  
API Server  
→ сохраняет запись в `conversations` (direction = in)  
→ находит leadId  
→ `POST /webhook/telegram_incoming` в n8n  
n8n  
→ AI-генерация ответа (при необходимости)  
→ повторная отправка через API Server/Userbot  
