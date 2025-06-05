const express = require('express');
const db = require('../database/connection');

const router = express.Router();

// N8N webhook endpoint
router.post('/n8n', async (req, res) => {
  try {
    console.log('N8N webhook received:', req.body);
        
    const { leadId, action, data } = req.body;
    
    if (!leadId || !action) {
      return res.status(400).json({ error: 'Missing leadId or action' });
    }
    
    switch (action) {
      case 'classification_update':
        await db.query(
          `UPDATE leads 
           SET ai_classification = $1, 
               ai_score = $2, 
               classification_stage = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [data.classification, data.score, data.stage, leadId]
        );
        break;
        
      case 'meeting_scheduled':
        await db.query(
          `INSERT INTO calendar_events (lead_id, title, start_time, end_time, status, created_at)
           VALUES ($1, $2, $3, $4, 'scheduled', CURRENT_TIMESTAMP)`,
          [leadId, data.title, data.start_time, data.end_time]
        );
        break;
        
      case 'message_sent':
        await db.query(
          `INSERT INTO conversations (lead_id, message_type, content, direction, created_at)
           VALUES ($1, $2, $3, 'outbound', CURRENT_TIMESTAMP)`,
          [leadId, data.type || 'text', data.content]
        );
        break;
        
      default:
        console.log('Unknown action:', action);
    }
    
    res.json({ success: true, processed: action });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generic webhook endpoint
router.post('/:source', async (req, res) => {
  try {
    const { source } = req.params;
    console.log(`Webhook from ${source}:`, req.body);
    
    // Log webhook data
    await db.query(
      `INSERT INTO webhook_logs (source, payload, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [source, JSON.stringify(req.body)]
    );
    
    res.json({ success: true, source });
  } catch (error) {
    console.error('Generic webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;