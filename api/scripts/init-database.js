#!/usr/bin/env node

// scripts/init-database.js
const DatabaseInitializer = require('../database/init');
const config = require('../database/config');
const { Pool } = require('pg');

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
const isReset = args.includes('--reset') || args.includes('-r');
const isForce = args.includes('--force') || args.includes('-f');
const isTest = args.includes('--test') || args.includes('-t');

// Тестирование подключения
async function runConnectionTests(config) {
    console.log('\n🧪 Тестирование подключений...');
    
    // Тест основного подключения
    try {
        const mainPool = new Pool(config);
        await mainPool.query('SELECT NOW()');
        await mainPool.end();
        console.log('  ✅ Основное подключение: OK');
    } catch (error) {
        console.log('  ❌ Основное подключение: FAILED');
        console.log(`     Ошибка: ${error.message}`);
    }
    
    // Тест подключения n8n пользователя
    try {
        const n8nPool = new Pool({
            ...config,
            user: config.n8nUser,
            password: config.n8nPassword
        });
        
        const result = await n8nPool.query('SELECT COUNT(*) FROM leads');
        await n8nPool.end();
        console.log(`  ✅ N8N подключение: OK (найдено ${result.rows[0].count} лидов)`);
    } catch (error) {
        console.log('  ❌ N8N подключение: FAILED');
        console.log(`     Ошибка: ${error.message}`);
    }
    
    // Тест доступности таблиц
    try {
        const testPool = new Pool({
            ...config,
            user: config.n8nUser,
            password: config.n8nPassword
        });
        
        const tables = ['leads', 'chat_history', 'meetings', 'ai_responses_log'];
        for (const table of tables) {
            await testPool.query(`SELECT 1 FROM ${table} LIMIT 1`);
            console.log(`  ✅ Таблица ${table}: OK`);
        }
        
        await testPool.end();
    } catch (error) {
        console.log(`  ❌ Доступ к таблицам: FAILED`);
        console.log(`     Ошибка: ${error.message}`);
    }
}

// Показать справку
function showHelp() {
    console.log('Использование: node scripts/init-database.js [опции]\n');
    console.log('Опции:');
    console.log('  --reset, -r     Сбросить и пересоздать базу данных');
    console.log('  --force, -f     Принудительное выполнение (для продакшн)');
    console.log('  --test, -t      Запустить тесты подключения после инициализации');
    console.log('  --help, -h      Показать эту справку\n');
    console.log('Примеры:');
    console.log('  node scripts/init-database.js                  # Обычная инициализация');
    console.log('  node scripts/init-database.js --reset          # Сброс и пересоздание');
    console.log('  node scripts/init-database.js --test           # С тестами');
    console.log('  NODE_ENV=production node scripts/init-database.js --force  # Продакшн');
}

async function main() {
    // Проверка справки
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    console.log('🚀 WhatsApp Sales Automation - Инициализация базы данных\n');
    
    // Показываем конфигурацию
    console.log('📋 Конфигурация:');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);
    console.log(`   N8N User: ${config.n8nUser}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
    
    // Подтверждение для продакшн
    if (process.env.NODE_ENV === 'production' && !isForce) {
        console.log('⚠️  ВНИМАНИЕ: Вы работаете в PRODUCTION окружении!');
        console.log('   Для продолжения используйте флаг --force\n');
        process.exit(1);
    }
    
    // Предупреждение для reset
    if (isReset && !isForce) {
        console.log('⚠️  ВНИМАНИЕ: Команда --reset удалит ВСЕ данные!');
        console.log('   Для подтверждения используйте флаг --force\n');
        process.exit(1);
    }
    
    const initializer = new DatabaseInitializer(config);
    
    try {
        let success = false;
        
        if (isReset) {
            console.log('🔄 Режим сброса: удаление и пересоздание БД...\n');
            success = await initializer.reset();
        } else {
            success = await initializer.initialize();
        }
        
        if (success) {
            console.log('\n✅ База данных готова к работе!');
            
            if (isTest) {
                await runConnectionTests(config);
            }
            
            console.log('\n📋 Следующие шаги:');
            console.log('1. Настройте credential в n8n с данными выше');
            console.log('2. Импортируйте workflow в n8n');
            console.log('3. Замените токены API в workflow');
            console.log('4. Запустите WhatsApp userbot');
            
            process.exit(0);
        } else {
            console.log('\n❌ Инициализация завершилась с ошибками');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 Критическая ошибка:', error.message);
        console.error('Стек:', error.stack);
        process.exit(1);
    }
}

// Обработка Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Инициализация прервана пользователем');
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Необработанная ошибка Promise:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Необработанное исключение:', error);
    process.exit(1);
});

// Запуск
main();