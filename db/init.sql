-- Создание пользователей и баз данных
CREATE USER n8n WITH PASSWORD 'n8n123';
CREATE USER leads_user WITH PASSWORD 'leads123';

CREATE DATABASE n8n OWNER n8n;
CREATE DATABASE leads_db OWNER leads_user;

-- Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;
GRANT ALL PRIVILEGES ON DATABASE leads_db TO leads_user;