const express = require('express');
const axios = require('axios');
const db = require('../database/connection');
const userbot = require('./userbot');

const router = express.Router();

router.post('/send', async (req, res) => {
  try {
    const { phone, message, leadId, chat_id } = req.body;
    
    console.log(`Mock: Sending to ${phone || chat_id}: ${message}`);
    
    await db.query(
      'INSERT INTO conversations (lead_id, platform, direction, message_type, content, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [leadId, 'telegram', 'outgoing', 'ai_response', message, JSON.stringify({ chat_id })]
    );
    
    res.json({ success: true, message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/userbot', async (req, res) => {
  try {
    const { chat_id, message, lead_id } = req.body;
    
    if (!userbot.isConnected) {
      return res.status(503).json({ error: 'Userbot not connected' });
    }
    
    await userbot.sendMessage(chat_id, message, lead_id);
    res.json({ success: true, messageId: Date.now() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/userbot/status', (req, res) => {
  res.json({ connected: userbot.isConnected });
});

module.exports = router;

