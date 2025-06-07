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
                
                const statements = sql
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        try {
                            await this.pool.query(statement.trim());
                        } catch (error) {
                            if (!error.message.includes('already exists')) {
                                console.warn(`⚠️ Предупреждение: ${error.message}`);
                            }
                        }
                    }
                }
                
                console.log(`✅ SQL файл ${filePath} выполнен`);
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
                if (!schemaCreated) return false;

                const tables = await this.checkTables();
                if (tables.length === 0) {
                    console.log('⚠️ Таблицы не найдены');
                    return false;
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
                    'DROP TABLE IF EXISTS leads CASCADE'
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
                
                return await this.initialize();
            } catch (error) {
                console.error('❌ Ошибка сброса БД:', error.message);
                return false;
            }
        }
    }

    module.exports = DatabaseInitializer;