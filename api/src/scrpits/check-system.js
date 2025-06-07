const { Pool } = require('pg');
const config = require('../src/database/config');
const axios = require('axios');

async function checkDatabase() {
  console.log('\n🔍 Проверка БД...');
  const pool = new Pool(config);
  
  try {
    // Проверяем подключение
    await pool.query('SELECT NOW()');
    console.log('  ✅ Подключение к БД: OK');
    
    // Проверяем таблицы
    const tables = ['leads', 'chat_history'];
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      
      if (result.rows[0].count > 0) {
        console.log(`  ✅ Таблица ${table}: существует`);
      } else {
        console.log(`  ❌ Таблица ${table}: НЕ НАЙДЕНА`);
        return false;
      }
    }
    
    // Проверяем данные
    const leadsCount = await pool.query('SELECT COUNT(*) FROM leads');
    const messagesCount = await pool.query('SELECT COUNT(*) FROM chat_history');
    
    console.log(`  📊 Лидов в БД: ${leadsCount.rows[0].count}`);
    console.log(`  📊 Сообщений в БД: ${messagesCount.rows[0].count}`);
    
    await pool.end();
    return true;
  } catch (error) {
    console.error('  ❌ Ошибка БД:', error.message);
    await pool.end();
    return false;
  }
}

async function checkN8n() {
  console.log('\n🔍 Проверка n8n...');
  
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
    const response = await axios.get(`${n8nUrl}/healthz`, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('  ✅ n8n доступен');
      return true;
    }
  } catch (error) {
    console.log('  ⚠️  n8n недоступен (возможно еще запускается)');
    return false;
  }
}

async function checkEnvVariables() {
  console.log('\n🔍 Проверка переменных окружения...');
  
  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'OPENAI_API_KEY'
  ];
  
  const warnings = [
    'NGROK_AUTHTOKEN',
    'N8N_WEBHOOK_URL'
  ];
  
  let allGood = true;
  
  for (const key of required) {
    if (process.env[key]) {
      console.log(`  ✅ ${key}: установлен`);
    } else {
      console.log(`  ❌ ${key}: НЕ УСТАНОВЛЕН`);
      allGood = false;
    }
  }
  
  for (const key of warnings) {
    if (process.env[key]) {
      console.log(`  ✅ ${key}: установлен`);
    } else {
      console.log(`  ⚠️  ${key}: не установлен (может потребоваться)`);
    }
  }
  
  return allGood;
}

async function main() {
  console.log('🚀 Проверка готовности системы WhatsApp Sales Automation\n');
  
  const envOk = await checkEnvVariables();
  const dbOk = await checkDatabase();
  const n8nOk = await checkN8n();
  
  console.log('\n📋 Итоговый статус:');
  console.log(`  Переменные окружения: ${envOk ? '✅' : '❌'}`);
  console.log(`  База данных: ${dbOk ? '✅' : '❌'}`);
  console.log(`  n8n: ${n8nOk ? '✅' : '⚠️'}`);
  
  if (!envOk || !dbOk) {
    console.log('\n❌ Система не готова к работе!');
    console.log('\nРекомендации:');
    if (!envOk) console.log('  1. Скопируйте .env.example в .env и заполните переменные');
    if (!dbOk) console.log('  2. Запустите: npm run db:init');
    process.exit(1);
  } else {
    console.log('\n✅ Система готова к работе!');
    if (!n8nOk) {
      console.log('\n⚠️  n8n еще не запущен. Запустите: docker-compose up -d');
    }
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});