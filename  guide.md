# Гайд по перезапуску и переинициализации системы

## Полный перезапуск с новой структурой БД

```bash
# 1. Остановить все контейнеры
docker-compose down -v

# 2. Удалить volumes (УДАЛИТ ВСЕ ДАННЫЕ!)
docker volume prune -f

# 3. Пересобрать и запустить
docker-compose up --build -d

# 4. Проверить статус
docker-compose ps
```

## Переинициализация только БД

```bash
# 1. Остановить API (чтобы освободить подключения)
docker-compose stop api

# 2. Подключиться к контейнеру postgres
docker-compose exec postgres psql -U postgres

# 3. В psql выполнить:
DROP DATABASE IF EXISTS leads_db;
CREATE DATABASE leads_db OWNER leads_user;
\q

# 4. Запустить API для инициализации схемы
docker-compose start api

# 5. Проверить логи
docker-compose logs api
```

## Инициализация БД через скрипт

```bash
# Через API контейнер
docker-compose exec api npm run db:init

# Сброс и переинициализация
docker-compose exec api npm run db:reset -- --force

# Тест подключения
docker-compose exec api npm run db:test
```

## Проверка состояния системы

```bash
# Логи всех сервисов
docker-compose logs -f

# Статус WhatsApp (QR код)
curl http://localhost:3000/whatsapp/status

# Статистика БД
curl http://localhost:3000/stats

# Health check
curl http://localhost:3000/health
```

## Troubleshooting

```bash
# Если БД не доступна
docker-compose restart postgres
docker-compose logs postgres

# Если WhatsApp не подключается
docker-compose exec api rm -rf sessions/*
docker-compose restart api

# Если n8n не стартует
docker-compose logs n8n
docker-compose restart n8n
```

## Быстрые команды

```bash
# Перезапуск API
docker-compose restart api

# Очистка сессий WhatsApp
docker-compose exec api rm -rf sessions/*

# Просмотр БД через Adminer (если включен)
# http://localhost:8080
```




# Остановить и удалить все контейнеры
docker-compose down -v

# Удалить все volumes
docker volume prune -f

# Очистить сессии WhatsApp (проблема с правами)
sudo rm -rf api/sessions/*

# Или если нужно удалить всю папку sessions
sudo rm -rf api/sessions
mkdir -p api/sessions
chmod 755 api/sessions

# Очистить все docker образы проекта
docker-compose down --rmi all

# Пересобрать и запустить заново
docker-compose up --build -d