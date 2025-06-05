// database/config.js
require('dotenv').config();

const config = {
    // Основные настройки подключения
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'whatsapp_sales_automation',
    
    // Настройки пользователя для n8n
    n8nUser: process.env.N8N_DB_USER || 'n8n_user',
    n8nPassword: process.env.N8N_DB_PASSWORD || 'n8n_secure_password_123',
    
    // Настройки пула соединений
    pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 20,
        min: parseInt(process.env.DB_POOL_MIN) || 0,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    
    // SSL настройки (для продакшн)
    ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
    } : false
};

module.exports = config;