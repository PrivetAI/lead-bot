const express = require('express');
const db = require('../database/connection');

const router = express.Router();

const mockAmoCRMData = [
  { id: 1001, name: 'Иван Петров', phone: '+66812345678', email: 'ivan@example.com', status: 'новый', source: 'Instagram' },
  { id: 1002, name: 'Maria Garcia', phone: '+66823456789', email: 'maria@example.com', status: 'в работе', source: 'Facebook' },
  { id: 1003, name: 'John Smith', phone: '+66834567890', email: 'john@example.com', status: 'назначена встреча', source: 'Website' },
  { id: 1004, name: 'Anna Kowalski', phone: '+66845678901', email: 'anna@example.com', status: 'новый', source: 'Google Ads' },
  { id: 1005, name: 'Chen Wei', phone: '+66856789012', email: 'chen@example.com', status: 'в работе', source: 'Referral' }
];

router.post('/sync', async (req, res) => {
  try {
    console.log('Syncing leads from amoCRM...');
    
    for (const lead of mockAmoCRMData) {
      await db.query(`
        INSERT INTO leads (amocrm_id, name, phone, email, status, source)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (amocrm_id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          updated_at = CURRENT_TIMESTAMP
      `, [lead.id, lead.name, lead.phone, lead.email, lead.status, lead.source]);
    }
    
    res.json({ 
      success: true, 
      message: `Synced ${mockAmoCRMData.length} leads`,
      count: mockAmoCRMData.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/update', async (req, res) => {
  try {
    const { leadId, status, note } = req.body;
    
    await db.query(
      'UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, leadId]
    );
    
    if (note) {
      await db.query(
        'INSERT INTO conversations (lead_id, message_type, content) VALUES ($1, $2, $3)',
        [leadId, 'note', note]
      );
    }
    
    console.log(`Updated lead ${leadId} status to ${status}`);
    
    res.json({ success: true, message: 'Lead updated in amoCRM' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { leads } = req.body;
    
    if (!leads) {
      return res.status(400).json({ error: 'No leads data' });
    }
    
    console.log('amoCRM webhook received:', leads.status?.[0]?.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;