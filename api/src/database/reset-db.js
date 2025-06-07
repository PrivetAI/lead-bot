const DatabaseInitializer = require('./init');
const config = require('./config');

async function resetDatabase() {
  console.log('🔄 Сброс и переинициализация БД...\n');
  
  const dbInitializer = new DatabaseInitializer(config);
  
  try {
    const success = await dbInitializer.reset();
    
    if (success) {
      console.log('\n✅ База данных успешно переинициализирована!');
      process.exit(0);
    } else {
      console.log('\n❌ Ошибка переинициализации БД');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

resetDatabase();