const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const db = require('../database/connection');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
  }

  async initialize() {
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'lead-bot' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.client.on('qr', (qr) => {
      this.qrCode = qr;
      console.log('WhatsApp QR code generated');
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCode = null;
      console.log('WhatsApp client ready');
    });

    this.client.on('message', (message) => {
      this.handleIncomingMessage(message);
    });

    await this.client.initialize();
  }

  async handleIncomingMessage(message) {
    try {
      if (message.from === 'status@broadcast') return;

      const contact = await message.getContact();
      const chat = await message.getChat();
      
      const messageData = {
        wa_id: message.from,
        wa_phone: contact.number,
        message: message.body,
        message_type: message.type,
        timestamp: message.timestamp
      };

      await this.sendToN8n({
        ...messageData,
        direction: 'incoming',
        contact_name: contact.name || contact.pushname
      });

      await this.saveMessage(messageData, 'incoming');
    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
    }
  }

  async sendMessage(waId, message, leadId = null) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client not ready');
      }

      await this.client.sendMessage(waId, message);

      await this.sendToN8n({
        wa_id: waId,
        message,
        lead_id: leadId,
        direction: 'outgoing'
      });

      await this.saveMessage({
        wa_id: waId,
        message,
        message_type: 'text'
      }, 'outgoing', leadId);

      return { success: true };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async saveMessage(messageData, direction, leadId = null) {
    try {
      await db.query(
        'INSERT INTO conversations (lead_id, platform, direction, message_type, content, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          leadId,
          'whatsapp',
          direction,
          messageData.message_type || 'text',
          messageData.message,
          JSON.stringify({
            wa_id: messageData.wa_id,
            wa_phone: messageData.wa_phone,
            timestamp: messageData.timestamp
          })
        ]
      );
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }

  async sendToN8n(data) {
    try {
      await axios.post(`${process.env.N8N_BASE_URL || 'http://n8n:5678'}/webhook/whatsapp`, data);
    } catch (error) {
      console.error('Error sending to n8n:', error);
    }
  }

  async sendWelcomeMessage(waId, leadData) {
    const welcomeMessage = `Добро пожаловать, ${leadData.name}! 👋

Спасибо за интерес к нашим решениям. Я ваш персональный помощник и готов ответить на любые вопросы.

Расскажите, пожалуйста, чем я могу помочь? Какие задачи вы хотели бы решить?`;

    await this.sendMessage(waId, welcomeMessage, leadData.id);
  }
}

module.exports = new WhatsAppService();