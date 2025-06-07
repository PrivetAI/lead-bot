const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./database/connection');
const whatsappRouter = require('./whatsapp/routes');
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
    
    // Дополнительная статистика
    const messagesByAgent = await db.query(
      `SELECT ai_agent, COUNT(*) FROM chat_history 
       WHERE ai_agent IS NOT NULL 
       GROUP BY ai_agent`
    );
    
    const hotLeads = await db.query(
      `SELECT COUNT(*) FROM leads WHERE classification = 'hot'`
    );
    
    res.json({
      total_leads: parseInt(totalLeads.rows[0].count),
      hot_leads: parseInt(hotLeads.rows[0].count),
      by_status: leadsByStatus.rows,
      by_classification: leadsByClassification.rows,
      messages_24h: parseInt(messagesLast24h.rows[0].count),
      messages_by_agent: messagesByAgent.rows
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
      console.log('  POST /whatsapp/send');
      console.log('  POST /whatsapp/welcome');
      console.log('  GET  /whatsapp/status');
      console.log('  GET  /whatsapp/qr');
      console.log('  POST /init-db');
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