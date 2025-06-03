const express = require('express');
const axios = require('axios');
const db = require('../database/connection');

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
    const { chat_id, message, lead_id, message_type, calendar_actions } = req.body;
    
    console.log(`Mock userbot: ${message_type} to chat ${chat_id}`);
    
    await db.query(
      'INSERT INTO conversations (lead_id, platform, direction, message_type, content, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [lead_id, 'telegram', 'outgoing', message_type, message, JSON.stringify({ chat_id, calendar_actions })]
    );
    
    res.json({ success: true, messageId: Date.now() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;