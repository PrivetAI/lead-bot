const express = require('express');
const whatsappService = require('./service');

const router = express.Router();

router.post('/send', async (req, res) => {
  try {
    const { wa_id, message, lead_id } = req.body;
    
    if (!whatsappService.isReady) {
      return res.status(503).json({ error: 'WhatsApp not ready' });
    }

    await whatsappService.sendMessage(wa_id, message, lead_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post('/welcome', async (req, res) => {
  try {
    const { wa_id, message, id } = req.body;
    
    await whatsappService.sendWelcomeMessage(wa_id, message, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;