const DatabaseInitializer = require('../src/database/init');
const config = require('../src/database/config');

async function main() {
    const args = process.argv.slice(2);
    const isReset = args.includes('--reset');
    const isTest = args.includes('--test');
    
    console.log('🚀 Инициализация базы данных...\n');
    
    const dbInitializer = new DatabaseInitializer(config);
    
    try {
        let success;
        
        if (isReset) {
            console.log('🔄 Режим сброса БД');
            success = await dbInitializer.reset();
        } else if (isTest) {
            console.log('🧪 Тестовый режим');
            success = await dbInitializer.createConnection();
            if (success) {
                console.log('✅ Подключение к БД работает');
                await dbInitializer.pool.end();
            }
        } else {
            success = await dbInitializer.initialize();
        }
        
        if (success) {
            console.log('\n✅ Операция завершена успешно!');
            process.exit(0);
        } else {
            console.log('\n❌ Операция завершена с ошибками');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        process.exit(1);
    }
}

main();