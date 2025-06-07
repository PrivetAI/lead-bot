const express = require('express');
const whatsappService = require('./service');

const router = express.Router();

// Отправка сообщения
router.post('/send', async (req, res) => {
  try {
    const { wa_id, phone, message, lead_id, amocrm_id, ai_agent } = req.body;
    
    if (!whatsappService.isReady) {
      return res.status(503).json({ error: 'WhatsApp not ready' });
    }

    // Используем wa_id или phone
    const recipient = wa_id || phone;
    if (!recipient || !message) {
      return res.status(400).json({ error: 'Missing required fields: phone/wa_id and message' });
    }

    // Используем amocrm_id или lead_id
    const leadIdToUse = amocrm_id || lead_id;
    
    await whatsappService.sendMessage(recipient, message, leadIdToUse, ai_agent);
    res.json({ success: true });
  } catch (error) {
    console.error('Send route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отправка приветственного сообщения
router.post('/welcome', async (req, res) => {
  try {
    const { wa_id, phone, message, id, lead_id, amocrm_id } = req.body;
    
    const recipient = wa_id || phone;
    const leadIdToUse = amocrm_id || id || lead_id;
    
    if (!recipient || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await whatsappService.sendWelcomeMessage(recipient, message, leadIdToUse);
    res.json({ success: true });
  } catch (error) {
    console.error('Welcome route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить статус WhatsApp
router.get('/status', (req, res) => {
  res.json(whatsappService.getStatus());
});

// Получить QR код
router.get('/qr', (req, res) => {
  const status = whatsappService.getStatus();
  if (status.qrCode) {
    res.json({ qr: status.qrCode });
  } else {
    res.json({ qr: null, message: 'No QR code available' });
  }
});

module.exports = router;