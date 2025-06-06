// database/config.js
require('dotenv').config();

// Определяем, запущен ли скрипт внутри Docker контейнера
const isInDocker = process.env.RUNNING_IN_DOCKER === 'true' || 
                  process.env.NODE_ENV === 'production' ||
                  process.env.DB_HOST === 'postgres';

// Если запущен локально, используем localhost вместо postgres
const getHost = () => {
    if (process.env.DB_HOST) {
        return process.env.DB_HOST;
    }
    
    // Если скрипт запущен локально, используем localhost
    if (!isInDocker) {
        return 'localhost';
    }
    
    return 'postgres';
};

const config = {
    // Основные настройки подключения
    host: getHost(),
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'leads_user',
    password: process.env.DB_PASSWORD || 'leads123',
    database: process.env.DB_NAME || 'leads_db',
    
    // Настройки пользователя для n8n (используем того же пользователя)
    n8nUser: process.env.DB_USER || 'leads_user',
    n8nPassword: process.env.DB_PASSWORD || 'leads123',
    
    // Настройки пула соединений
    pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 20,
        min: parseInt(process.env.DB_POOL_MIN) || 0,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    
    // SSL настройки (для продакшн)
    ssl: process.env.NODE_ENV === 'production' ? false : false // Отключаем SSL для локального Docker
};

// Логирование конфигурации для отладки
console.log(`Database config - Host: ${config.host}, IsInDocker: ${isInDocker}`);

module.exports = config;    