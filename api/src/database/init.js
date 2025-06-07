const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class DatabaseInitializer {
    constructor(config) {
        this.config = config;
        this.pool = null;
    }

    async createConnection() {
        try {
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database
            });
            console.log('✅ Подключение к PostgreSQL установлено');
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения:', error.message);
            return false;
        }
    }

    async executeSqlFile(filePath) {
        try {
            const fullPath = path.join(__dirname, filePath);
            const sql = await fs.readFile(fullPath, 'utf8');
            console.log(`📄 Выполнение SQL файла: ${filePath}`);
            
            // Выполняем весь файл как одну транзакцию
            try {
                await this.pool.query(sql);
                console.log(`✅ SQL файл ${filePath} выполнен успешно`);
                return true;
            } catch (error) {
                // Если ошибка, пробуем выполнить по частям
                console.log('⚠️ Ошибка при выполнении целого файла, пробуем по частям...');
                
                // Разбиваем на команды более аккуратно
                const commands = sql
                    .split(/;\s*$/m)
                    .map(cmd => cmd.trim())
                    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
                
                for (let i = 0; i < commands.length; i++) {
                    const command = commands[i];
                    if (command.trim()) {
                        try {
                            // Восстанавливаем точку с запятой для функций
                            let fullCommand = command;
                            if (command.includes('$$') || command.includes('CREATE FUNCTION') || command.includes('CREATE OR REPLACE FUNCTION')) {
                                fullCommand = command + ';';
                            }
                            
                            await this.pool.query(fullCommand);
                            console.log(`  ✅ Команда ${i + 1}/${commands.length} выполнена`);
                        } catch (cmdError) {
                            if (!cmdError.message.includes('already exists')) {
                                console.error(`  ❌ Ошибка в команде ${i + 1}:`, cmdError.message);
                                console.error(`     SQL: ${command.substring(0, 100)}...`);
                            }
                        }
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Ошибка выполнения SQL файла:`, error.message);
            return false;
        }
    }

    async checkTables() {
        try {
            const query = `
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY tablename
            `;
            
            const result = await this.pool.query(query);
            const tables = result.rows.map(row => row.tablename);
            
            console.log('📋 Существующие таблицы:');
            tables.forEach(table => console.log(`  - ${table}`));
            
            return tables;
        } catch (error) {
            console.error('❌ Ошибка проверки таблиц:', error.message);
            return [];
        }
    }

    async initialize() {
        console.log('🚀 Инициализация базы данных...\n');
        
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            const schemaCreated = await this.executeSqlFile('schema.sql');
            if (!schemaCreated) {
                console.log('⚠️ Были ошибки при создании схемы, но продолжаем...');
            }

            const tables = await this.checkTables();
            if (tables.length === 0) {
                console.log('⚠️ Таблицы не найдены, пробуем создать заново...');
                
                // Попробуем выполнить SQL напрямую
                try {
                    await this.pool.query(`
                        CREATE TABLE IF NOT EXISTS leads (
                            id SERIAL PRIMARY KEY,
                            amocrm_id VARCHAR(255) UNIQUE NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            phone VARCHAR(20) UNIQUE NOT NULL,
                            email VARCHAR(255),
                            wa_id VARCHAR(50),
                            status VARCHAR(50) DEFAULT 'new',
                            classification TEXT,
                            company_size TEXT,
                            budget_range TEXT,
                            needs TEXT,
                            urgency TEXT,
                            company_info TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    console.log('✅ Таблица leads создана');
                    
                    await this.pool.query(`
                        CREATE TABLE IF NOT EXISTS chat_history (
                            id SERIAL PRIMARY KEY,
                            lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
                            phone VARCHAR(20) NOT NULL,
                            message TEXT NOT NULL,
                            direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
                            ai_agent VARCHAR(20),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    console.log('✅ Таблица chat_history создана');
                    
                    // Создаем индексы
                    const indexes = [
                        'CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)',
                        'CREATE INDEX IF NOT EXISTS idx_leads_amocrm_id ON leads(amocrm_id)',
                        'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
                        'CREATE INDEX IF NOT EXISTS idx_leads_classification ON leads(classification)',
                        'CREATE INDEX IF NOT EXISTS idx_chat_lead_id ON chat_history(lead_id)',
                        'CREATE INDEX IF NOT EXISTS idx_chat_phone ON chat_history(phone)',
                        'CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_history(created_at)'
                    ];
                    
                    for (const idx of indexes) {
                        await this.pool.query(idx);
                    }
                    console.log('✅ Индексы созданы');
                    
                    // Создаем функцию и триггер
                    await this.pool.query(`
                        CREATE OR REPLACE FUNCTION update_updated_at_column()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            NEW.updated_at = CURRENT_TIMESTAMP;
                            RETURN NEW;
                        END;
                        $$ LANGUAGE plpgsql
                    `);
                    
                    await this.pool.query('DROP TRIGGER IF EXISTS update_leads_updated_at ON leads');
                    await this.pool.query(`
                        CREATE TRIGGER update_leads_updated_at 
                        BEFORE UPDATE ON leads
                        FOR EACH ROW 
                        EXECUTE FUNCTION update_updated_at_column()
                    `);
                    console.log('✅ Триггеры созданы');
                    
                } catch (createError) {
                    console.error('❌ Ошибка создания таблиц напрямую:', createError.message);
                    return false;
                }
            }

            console.log('\n✅ Инициализация завершена!');
            console.log('\n📝 Данные для подключения n8n:');
            console.log(`   Host: ${this.config.host}`);
            console.log(`   Database: ${this.config.database}`);
            console.log(`   User: ${this.config.user}`);
            console.log(`   Password: ${this.config.password}`);
            console.log(`   Port: ${this.config.port}`);
            
            return true;
        } catch (error) {
            console.error('❌ Критическая ошибка:', error.message);
            return false;
        } finally {
            if (this.pool) {
                await this.pool.end();
            }
        }
    }

    async reset() {
        console.log('🔄 Сброс базы данных...');
        
        try {
            const connected = await this.createConnection();
            if (!connected) return false;
            
            const dropQueries = [
                'DROP TABLE IF EXISTS chat_history CASCADE',
                'DROP TABLE IF EXISTS leads CASCADE',
                'DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE'
            ];
            
            for (const query of dropQueries) {
                try {
                    await this.pool.query(query);
                } catch (error) {
                    console.warn(`⚠️ ${error.message}`);
                }
            }
            
            console.log('✅ Таблицы удалены');
            await this.pool.end();
            this.pool = null;
            
            return await this.initialize();
        } catch (error) {
            console.error('❌ Ошибка сброса БД:', error.message);
            return false;
        }
    }
}

module.exports = DatabaseInitializer;