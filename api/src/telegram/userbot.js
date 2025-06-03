const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
const TelegramUserbot = require('./telegram/userbot');
const AmoCRMService = require('./amocrm/service');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const redis = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

const telegramUserbot = new TelegramUserbot();
const amoCRMService = new AmoCRMService();

app.post('/telegram/userbot', async (req, res) => {
  try {
    const { action, chatId, message, leadId } = req.body;
    
    if (action === 'send') {
      const result = await telegramUserbot.sendMessage(chatId, message);
      
      await pool.query(
        'INSERT INTO conversations (lead_id, message_type, platform, content, telegram_chat_id, telegram_message_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [leadId, 'outgoing', 'telegram', message, chatId, result.id]
      );
      
      res.json({ success: true, messageId: result.id });
    } else if (action === 'get_messages') {
      const messages = await telegramUserbot.getMessages(chatId, 50);
      res.json({ messages });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/amocrm/update', async (req, res) => {
  try {
    const { leadId, status, stageId, customFields } = req.body;
    
    await pool.query(
      'UPDATE leads SET status = $1, stage_id = $2, updated_at = CURRENT_TIMESTAMP WHERE amocrm_id = $3',
      [status, stageId, leadId]
    );
    
    const result = await amoCRMService.updateLead(leadId, { status, stageId, customFields });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/conversation/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const result = await pool.query(
      'SELECT * FROM conversations WHERE lead_id = $1 ORDER BY sent_at ASC',
      [leadId]
    );
    res.json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/amocrm/import', async (req, res) => {
  try {
    const leads = await amoCRMService.getAllLeads();
    
    for (const lead of leads) {
      await pool.query(`
        INSERT INTO leads (amocrm_id, name, phone, email, source, pipeline_id, stage_id, responsible_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (amocrm_id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        updated_at = CURRENT_TIMESTAMP
      `, [lead.id, lead.name, lead.phone, lead.email, lead.source, lead.pipeline_id, lead.stage_id, lead.responsible_user_id]);
    }
    
    res.json({ success: true, imported: leads.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

redis.connect().then(() => {
  console.log('Redis connected');
}).catch(console.error);

app.listen(process.env.PORT, () => {
  console.log(`API Server running on port ${process.env.PORT}`);
});