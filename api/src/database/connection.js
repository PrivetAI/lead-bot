// database/connection.js
const { Pool } = require('pg');
const config = require('./config');

// Создаем пул соединений
const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
    max: config.pool.max,
    min: config.pool.min,
    acquireTimeoutMillis: config.pool.acquire,
    idleTimeoutMillis: config.pool.idle
});

// Обработка ошибок подключения
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Функция для выполнения запросов
const query = async (text, params) => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Функция для получения клиента (для транзакций)
const getClient = async () => {
    return await pool.connect();
};

// Функция для закрытия пула
const end = async () => {
    await pool.end();
};

module.exports = {
    query,
    getClient,
    end,
    pool
};