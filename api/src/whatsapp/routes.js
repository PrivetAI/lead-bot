const express = require('express');
const whatsappService = require('./service');
const QRCode = require('qrcode');

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

router.get('/status', (req, res) => {
  res.json({ 
    ready: whatsappService.isReady,
    hasQR: !!whatsappService.qrCode
  });
});

router.get('/qr', async (req, res) => {
  try {
    if (!whatsappService.qrCode) {
      return res.status(404).json({ 
        error: 'No QR code available',
        hint: 'QR code appears after WhatsApp client initialization'
      });
    }

    const qrImage = await QRCode.toDataURL(whatsappService.qrCode);
    res.json({ 
      qr: qrImage,
      generated_at: whatsappService.qrGeneratedAt,
      expires_in: '60 seconds' // WhatsApp QR обычно действует 60 секунд
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Добавьте новый эндпоинт для получения QR-кода в разных форматах
router.get('/qr/:format', async (req, res) => {
  try {
    const { format } = req.params;
    
    if (!whatsappService.qrCode) {
      return res.status(404).json({ error: 'No QR code available' });
    }

    switch (format) {
      case 'png':
        const buffer = await QRCode.toBuffer(whatsappService.qrCode);
        res.set('Content-Type', 'image/png');
        res.send(buffer);
        break;
        
      case 'svg':
        const svg = await QRCode.toString(whatsappService.qrCode, { type: 'svg' });
        res.set('Content-Type', 'image/svg+xml');
        res.send(svg);
        break;
        
      case 'text':
        res.set('Content-Type', 'text/plain');
        res.send(whatsappService.qrCode);
        break;
        
      default:
        res.status(400).json({ error: 'Invalid format. Use: png, svg, or text' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/welcome', async (req, res) => {
  try {
    const { wa_id, lead_data } = req.body;
    
    await whatsappService.sendWelcomeMessage(wa_id, lead_data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;