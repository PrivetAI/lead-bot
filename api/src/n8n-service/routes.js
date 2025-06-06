const express = require('express');
const db = require('../database/connection');
const whatsappService = require('../whatsapp/service');

const router = express.Router();

// Webhook для обработки ответа от AI
router.post('/n8n', async (req, res) => {
  try {
    const { 
      lead_id, 
      wa_id, 
      message, 
      action_type,
      calendar_data 
    } = req.body;

    console.log('Received n8n webhook:', { lead_id, action_type });

    // Отправляем сообщение клиенту через WhatsApp
    if (wa_id && message) {
      // Показываем, что печатаем
      await whatsappService.sendTyping(wa_id);
      
      // Небольшая задержка для естественности
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Отправляем сообщение
      await whatsappService.sendMessage(wa_id, message, lead_id);
    }

    // Обновляем статус лида если нужно
    if (lead_id && action_type) {
      let newStatus = 'в работе';
      
      switch (action_type) {
        case 'classified':
          newStatus = 'классифицирован';
          break;
        case 'meeting_scheduled':
          newStatus = 'встреча назначена';
          break;
        case 'qualification_complete':
          newStatus = 'квалифицирован';
          break;
      }

      await db.query(
        'UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, lead_id]
      );
    }


    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook для приема новых лидов
router.post('/new-lead', async (req, res) => {
  try {
    const leadData = req.body;
    
    console.log('New lead received:', leadData);

    // Сохраняем или обновляем лид
    const result = await db.query(
      `INSERT INTO leads 
       (amocrm_id, name, phone, email, wa_id, status, source, budget, product_interest, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (amocrm_id) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        leadData.amocrm_id,
        leadData.name,
        leadData.phone,
        leadData.email,
        leadData.wa_id || leadData.phone?.replace(/\D/g, '') + '@c.us',
        'новый',
        leadData.source || 'unknown',
        leadData.budget,
        leadData.product_interest,
        leadData.notes
      ]
    );

    const lead = result.rows[0];

    // Отправляем приветственное сообщение
    if (lead.wa_id || lead.phone) {
      const waId = lead.wa_id || lead.phone.replace(/\D/g, '') + '@c.us';
      
      setTimeout(async () => {
        await whatsappService.sendWelcomeMessage(waId, lead);
      }, 5000); // Отправляем через 5 секунд
    }

    res.json({ success: true, lead_id: lead.id });
  } catch (error) {
    console.error('Error processing new lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook для обработки действий AI агента
router.post('/agent-action', async (req, res) => {
  try {
    const { lead_id, agent_type, action_type, action_data } = req.body;

    // Сохраняем действие агента
    await db.query(
      `INSERT INTO agent_actions 
       (lead_id, agent_type, action_type, action_data, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [lead_id, agent_type, action_type, JSON.stringify(action_data), 'completed']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving agent action:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;