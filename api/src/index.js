const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./database/connection');
const whatsappRouter = require('./whatsapp/routes');
const amocrmRouter = require('./amocrm/routes');
const whatsappService = require('./whatsapp/service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/whatsapp', whatsappRouter);
app.use('/amocrm', amocrmRouter);

// Инициализация БД при старте
app.post('/init-db', async (req, res) => {
  try {
    const DatabaseInitializer = require('./database/init');
    const config = require('./database/config');
    const initializer = new DatabaseInitializer(config);
    const success = await initializer.initialize();
    
    if (success) {
      res.json({ success: true, message: 'Database initialized' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to initialize database' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      timestamp: new Date(),
      whatsapp: whatsappService.isReady ? 'ready' : 'not ready'
    });
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message });
  }
});

// Получить историю чата
app.get('/chat/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const result = await db.query(
      `SELECT * FROM chat_history 
       WHERE lead_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [leadId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить информацию о лиде
app.get('/lead/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const leadResult = await db.query(
      'SELECT * FROM leads WHERE id = $1 OR lead_id = $1',
      [id]
    );
    
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const lead = leadResult.rows[0];
    
    // Получаем последние сообщения
    const messagesResult = await db.query(
      `SELECT * FROM chat_history 
       WHERE lead_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [lead.id]
    );
    
    lead.recent_messages = messagesResult.rows;
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить классификацию лида
app.post('/lead/:id/classify', async (req, res) => {
  try {
    const { id } = req.params;
    const { classification, company_size, budget_range, needs } = req.body;
    
    await db.query(
      `UPDATE leads 
       SET classification = $1, 
           company_size = $2, 
           budget_range = $3,
           needs = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [classification, company_size, budget_range, needs, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Статистика
app.get('/stats', async (req, res) => {
  try {
    const totalLeads = await db.query('SELECT COUNT(*) FROM leads');
    const leadsByStatus = await db.query(
      'SELECT status, COUNT(*) FROM leads GROUP BY status'
    );
    const leadsByClassification = await db.query(
      'SELECT classification, COUNT(*) FROM leads WHERE classification IS NOT NULL GROUP BY classification'
    );
    const messagesLast24h = await db.query(
      `SELECT COUNT(*) FROM chat_history 
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );
    
    res.json({
      total_leads: parseInt(totalLeads.rows[0].count),
      by_status: leadsByStatus.rows,
      by_classification: leadsByClassification.rows,
      messages_24h: parseInt(messagesLast24h.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  try {
    // Проверяем таблицы БД
    console.log('Checking database tables...');
    try {
      await db.query('SELECT 1 FROM leads LIMIT 1');
      await db.query('SELECT 1 FROM chat_history LIMIT 1');
      console.log('✅ Database tables exist');
    } catch (error) {
      console.error('❌ Database tables missing:', error.message);
      console.log('Run: npm run db:init');
      process.exit(1);
    }
    
    if (process.env.DISABLE_WHATSAPP !== 'true') {
      console.log('Starting WhatsApp service...');
      await whatsappService.initialize();
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 API server running on port ${PORT}`);
      console.log('📍 Available endpoints:');
      console.log('  GET  /health');
      console.log('  GET  /stats');
      console.log('  GET  /lead/:id');
      console.log('  GET  /chat/:leadId');
      console.log('  POST /lead/:id/classify');
      console.log('  POST /whatsapp/send');
      console.log('  POST /amocrm/sync\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  if (whatsappService.client) {
    await whatsappService.destroy();
  }
  await db.end();
  process.exit(0);
});

startServer();