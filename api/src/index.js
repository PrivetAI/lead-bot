const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./database/connection');
const whatsappRouter = require('./whatsapp/routes');
const amocrmRouter = require('./amocrm/routes');
const webhookRouter = require('./webhook/routes');
const whatsappService = require('./whatsapp/service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/whatsapp', whatsappRouter);
app.use('/amocrm', amocrmRouter);
app.use('/webhook', webhookRouter);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Проверяем подключение к БД
    await db.query('SELECT 1');
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date(),
      services: {
        database: 'connected',
        whatsapp: whatsappService.isReady ? 'ready' : 'not ready'
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// API для получения истории разговора
app.get('/conversation/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const result = await db.query(
      `SELECT * FROM conversations 
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

// API для получения информации о лиде
app.get('/lead/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const leadResult = await db.query(
      'SELECT * FROM leads WHERE id = $1 OR amocrm_id = $1',
      [id]
    );
    
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const lead = leadResult.rows[0];
    
    // Получаем последние сообщения
    const messagesResult = await db.query(
      `SELECT * FROM conversations 
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

// API для обновления классификации лида
app.post('/lead/:id/classification', async (req, res) => {
  try {
    const { id } = req.params;
    const { classification, score, stage } = req.body;
    
    await db.query(
      `UPDATE leads 
       SET ai_classification = $1, 
           ai_score = $2, 
           classification_stage = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [classification, score, stage, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API для статистики
app.get('/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Общее количество лидов
    const totalLeads = await db.query('SELECT COUNT(*) FROM leads');
    stats.total_leads = parseInt(totalLeads.rows[0].count);
    
    // Лиды по статусам
    const leadsByStatus = await db.query(
      'SELECT status, COUNT(*) FROM leads GROUP BY status'
    );
    stats.leads_by_status = leadsByStatus.rows;
    
    // Лиды по источникам
    const leadsBySource = await db.query(
      'SELECT source, COUNT(*) FROM leads GROUP BY source'
    );
    stats.leads_by_source = leadsBySource.rows;
    
    // Сообщения за последние 24 часа
    const recentMessages = await db.query(
      `SELECT COUNT(*) FROM conversations 
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );
    stats.messages_24h = parseInt(recentMessages.rows[0].count);
    
    // Запланированные встречи
    const upcomingMeetings = await db.query(
      `SELECT COUNT(*) FROM calendar_events 
       WHERE start_time > NOW() AND status = 'scheduled'`
    );
    stats.upcoming_meetings = parseInt(upcomingMeetings.rows[0].count);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  try {
    // Инициализируем WhatsApp
    console.log('Starting WhatsApp service...');
    await whatsappService.initialize();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API server running on port ${PORT}`);
      console.log('Available endpoints:');
      console.log('  GET  /health');
      console.log('  GET  /stats');
      console.log('  GET  /whatsapp/status');
      console.log('  GET  /whatsapp/qr');
      console.log('  POST /whatsapp/send');
      console.log('  POST /amocrm/sync');
      console.log('  POST /webhook/n8n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  if (whatsappService.client) {
    await whatsappService.client.destroy();
  }
  
  await db.end();
  process.exit(0);
});

startServer();