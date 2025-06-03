const express = require('express');
const { TelegramApi } = require('telegram');
const { StringSession } = require('telegram/sessions');
const axios = require('axios');
const db = require('../database/connection');

const router = express.Router();
let client = null;

const initTelegram = async () => {
  if (client) return client;
  
  try {
    const session = new StringSession(process.env.TELEGRAM_SESSION_STRING || '');
    client = new TelegramApi(session, process.env.TELEGRAM_API_ID, process.env.TELEGRAM_API_HASH, {
      connectionRetries: 5,
    });
    
    await client.start({
      phoneNumber: async () => await input.text('Phone: '),
      password: async () => await input.text('Password: '),
      phoneCode: async () => await input.text('Code: '),
      onError: (err) => console.log('Telegram auth error:', err),
    });
    
    console.log('Telegram userbot connected');
    
    client.addEventHandler(handleNewMessage, { func: (event) => event.isPrivate });
    
    return client;
  } catch (error) {
    console.error('Telegram init error:', error);
    throw error;
  }
};

const handleNewMessage = async (event) => {
  try {
    const message = event.message;
    const phone = message.peerId?.userId ? await getPhoneByUserId(message.peerId.userId) : null;
    
    if (!phone) return;
    
    const lead = await db.query('SELECT * FROM leads WHERE phone = $1', [`+${phone}`]);
    
    if (lead.rows.length === 0) return;
    
    const leadId = lead.rows[0].id;
    
    await db.query(
      'INSERT INTO conversations (lead_id, message_type, content, telegram_message_id) VALUES ($1, $2, $3, $4)',
      [leadId, 'incoming', message.message, message.id]
    );
    
    await axios.post(`${process.env.N8N_WEBHOOK_URL}/telegram-message`, {
      leadId,
      message: message.message,
      phone
    });
    
  } catch (error) {
    console.error('Message handler error:', error);
  }
};

const getPhoneByUserId = async (userId) => {
  // Mock implementation - в реальности нужно получить телефон через Telegram API
  return null;
};

router.post('/send', async (req, res) => {
  try {
    const { phone, message, leadId } = req.body;
    
    if (!client) {
      await initTelegram();
    }
    
    // Mock отправка - в реальности используем client.sendMessage
    console.log(`Sending to ${phone}: ${message}`);
    
    await db.query(
      'INSERT INTO conversations (lead_id, message_type, content) VALUES ($1, $2, $3)',
      [leadId, 'outgoing', message]
    );
    
    res.json({ success: true, message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/init', async (req, res) => {
  try {
    await initTelegram();
    res.json({ success: true, message: 'Telegram userbot initialized' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;