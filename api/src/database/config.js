// database/config.js
require('dotenv').config();

const config = {
    // Основные настройки подключения
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
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

module.exports = config;
