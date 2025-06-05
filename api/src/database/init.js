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
            // Подключаемся к уже существующей базе данных
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
            console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
            return false;
        }
    }

    async executeSqlFile(filePath) {
        try {
            const fullPath = path.join(__dirname, filePath);
            const sql = await fs.readFile(fullPath, 'utf8');
            
            console.log(`📄 Выполнение SQL файла: ${filePath}`);
            
            // Разделяем на отдельные команды, игнорируя комментарии
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await this.pool.query(statement.trim());
                    } catch (error) {
                        // Игнорируем ошибки "уже существует"
                        if (!error.message.includes('already exists') && 
                            !error.message.includes('уже существует') &&
                            !error.message.includes('duplicate key')) {
                            console.warn(`⚠️ Предупреждение в SQL: ${error.message}`);
                        }
                    }
                }
            }
            
            console.log(`✅ SQL файл ${filePath} выполнен успешно`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка выполнения SQL файла ${filePath}:`, error.message);
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
            tables.forEach(table => {
                console.log(`  - ${table}`);
            });
            
            return tables;
        } catch (error) {
            console.error('❌ Ошибка проверки таблиц:', error.message);
            return [];
        }
    }

    async insertTestData() {
        try {
            console.log('📝 Проверка тестовых данных...');
            
            // Проверяем новые таблицы (для n8n workflow)
            const newTestLeads = [
                {
                    lead_id: 2001,
                    name: 'Тест N8N Лид',
                    phone: '79001112233',
                    company_info: 'Тестовая компания для N8N',
                    business_type: 'IT',
                    status: 'new'
                }
            ];

            // Проверяем, есть ли таблица leads с новой структурой
            const checkTableQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'leads' AND column_name = 'lead_id'
            `;
            
            const tableResult = await this.pool.query(checkTableQuery);
            
            if (tableResult.rows.length > 0) {
                for (const lead of newTestLeads) {
                    const checkQuery = `SELECT 1 FROM leads WHERE lead_id = $1`;
                    const existing = await this.pool.query(checkQuery, [lead.lead_id]);
                    
                    if (existing.rows.length === 0) {
                        const insertQuery = `
                            INSERT INTO leads (lead_id, name, phone, company_info, business_type, status) 
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `;
                        
                        await this.pool.query(insertQuery, [
                            lead.lead_id,
                            lead.name,
                            lead.phone,
                            lead.company_info,
                            lead.business_type,
                            lead.status
                        ]);
                        
                        console.log(`  ✅ Добавлен тестовый лид: ${lead.name}`);
                    } else {
                        console.log(`  ⚠️ Лид ${lead.name} уже существует`);
                    }
                }
            } else {
                console.log('  ℹ️ Таблица leads имеет старую структуру, тестовые данные не добавлены');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка вставки тестовых данных:', error.message);
            return false;
        }
    }

    async initialize() {
        console.log('🚀 Инициализация дополнительных таблиц для n8n workflow...\n');
        
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            console.log('ℹ️ База данных и пользователь уже существуют (созданы через Docker)');

            const schemaCreated = await this.executeSqlFile('schema.sql');
            if (!schemaCreated) return false;

            const tables = await this.checkTables();
            if (tables.length === 0) {
                console.log('⚠️ Таблицы не найдены');
                return false;
            }

            await this.insertTestData();

            console.log('\n🎉 Инициализация завершена успешно!');
            console.log('\n📝 Данные для подключения n8n:');
            console.log(`   Host: ${this.config.host}`);
            console.log(`   Database: ${this.config.database}`);
            console.log(`   User: ${this.config.user}`);
            console.log(`   Password: ${this.config.password}`);
            console.log(`   Port: ${this.config.port}`);
            
            return true;
        } catch (error) {
            console.error('❌ Критическая ошибка инициализации:', error.message);
            return false;
        } finally {
            if (this.pool) {
                await this.pool.end();
            }
        }
    }

    async reset() {
        console.log('🔄 Сброс таблиц базы данных...');
        
        try {
            const connected = await this.createConnection();
            if (!connected) return false;
            
            // Удаляем существующие таблицы для n8n workflow
            const dropQueries = [
                'DROP TABLE IF EXISTS ai_responses_log CASCADE',
                'DROP TABLE IF EXISTS meetings CASCADE', 
                'DROP TABLE IF EXISTS chat_history CASCADE',
                'DROP TABLE IF EXISTS system_settings CASCADE',
                'DROP VIEW IF EXISTS lead_analytics CASCADE',
                'DROP VIEW IF EXISTS chat_statistics CASCADE',
                'DROP VIEW IF EXISTS sales_funnel CASCADE'
            ];
            
            for (const query of dropQueries) {
                try {
                    await this.pool.query(query);
                } catch (error) {
                    console.warn(`⚠️ ${error.message}`);
                }
            }
            
            console.log('✅ Старые таблицы удалены');
            
            await this.pool.end();
            
            return await this.initialize();
        } catch (error) {
            console.error('❌ Ошибка сброса базы данных:', error.message);
            return false;
        }
    }
}

module.exports = DatabaseInitializer;
