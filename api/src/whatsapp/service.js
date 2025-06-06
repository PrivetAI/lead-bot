const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const db = require('../database/connection');
const qrcodeTerminal = require('qrcode-terminal');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
  }

  async initialize() {
    try {
      console.log('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'lead-bot',
          dataPath: './sessions'
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ]
        }
      });

      this.setupEventHandlers();
      await this.client.initialize();

    } catch (error) {
      console.error('Failed to initialize WhatsApp:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      this.qrCode = qr;
      console.log('\n📱 WhatsApp QR Code:');
      qrcodeTerminal.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCode = null;
      console.log('✅ WhatsApp connected!');
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp auth failure:', msg);
      this.isReady = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp disconnected:', reason);
      this.isReady = false;
      setTimeout(() => this.reconnect(), 10000);
    });

    this.client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  async reconnect() {
    try {
      if (this.client) {
        await this.client.destroy();
      }
      await this.initialize();
    } catch (error) {
      console.error('Reconnection failed:', error);
      setTimeout(() => this.reconnect(), 30000);
    }
  }

  async handleIncomingMessage(message) {
    try {
      if (message.isStatus || message.broadcast) return;

      const chat = await message.getChat();
      if (chat.isGroup) return;

      const contact = await message.getContact();
      // Получаем чистый номер без @c.us
      const phoneNumber = contact.id.user || contact.number || message.from.split('@')[0];

      console.log('📩 Message from:', phoneNumber, ':', message.body);

      // Проверяем лида по номеру телефона
      let leadResult;
      try {
        leadResult = await db.query(
          'SELECT id FROM leads WHERE phone = $1 OR phone = $2',
          [phoneNumber, '+' + phoneNumber]
        );
      } catch (error) {
        console.error('Error querying lead:', error.message);
        leadResult = { rows: [] };
      }

      let leadId = null;
      if (leadResult.rows.length > 0) {
        leadId = leadResult.rows[0].id;
      }

      // Сохраняем сообщение в БД
      try {
        await db.query(
          `INSERT INTO chat_history (lead_id, phone, message, direction) 
           VALUES ($1, $2, $3, $4)`,
          [leadId, phoneNumber, message.body, 'incoming']
        );
        console.log('💾 Message saved to DB');
      } catch (dbError) {
        console.error('Error saving to DB:', dbError);
      }

      // Отправляем в n8n
      await this.sendToN8n({
        phone: phoneNumber,
        message: message.body,
        lead_id: leadId,
        direction: 'incoming',
        contact_name: contact.name || contact.pushname || phoneNumber,
        timestamp: new Date().toISOString()
      });

      await this.sendSeen(message.from);

    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  async sendMessage(waId, message, leadId = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp not ready');
    }

    try {
      // Форматируем номер
      const formattedNumber = this.formatPhoneNumber(waId);
      
      await this.sendTyping(formattedNumber);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const sentMessage = await this.client.sendMessage(formattedNumber, message);
      console.log(`✅ Message sent to ${formattedNumber}`);

      // Сохраняем в БД - извлекаем чистый номер без @c.us
      const phoneNumber = formattedNumber.replace('@c.us', '');
      
      try {
        // Если leadId не передан, пытаемся найти его по номеру
        if (!leadId) {
          const leadResult = await db.query(
            'SELECT id FROM leads WHERE phone = $1 OR phone = $2',
            [phoneNumber, '+' + phoneNumber]
          );
          if (leadResult.rows.length > 0) {
            leadId = leadResult.rows[0].id;
          }
        }

        await db.query(
          `INSERT INTO chat_history (lead_id, phone, message, direction) 
           VALUES ($1, $2, $3, $4)`,
          [leadId, phoneNumber, message, 'outgoing']
        );
        console.log('💾 Outgoing message saved to DB');
      } catch (dbError) {
        console.error('Error saving outgoing message to DB:', dbError);
      }

      return { success: true, messageId: sentMessage.id };
    } catch (error) {
      console.error('Send error:', error);
      throw error;
    }
  }

  async sendToN8n(data) {
    try {
      const n8nUrl = process.env.N8N_WEBHOOK_URL + '/whatsapp-userbot-webhook';
      await axios.post(n8nUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log('📤 Sent to n8n');
    } catch (error) {
      console.error('Error sending to n8n:', error.message);
    }
  }

  async sendWelcomeMessage(phoneNumber, message = '', leadId) {
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    return await this.sendMessage(formattedNumber, message, leadId);
  }

  async sendTyping(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      await chat.sendStateTyping();
    } catch (error) {
      console.error('Error sending typing:', error);
    }
  }

  async sendSeen(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      await chat.sendSeen();
    } catch (error) {
      console.error('Error sending seen:', error);
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Удаляем все нецифровые символы кроме +
    let cleaned = String(phoneNumber).replace(/[^\d+]/g, '');
    
    // Если номер уже в формате @c.us, возвращаем как есть
    if (String(phoneNumber).includes('@c.us')) {
      return String(phoneNumber);
    }
    
    // Удаляем + для формата WhatsApp
    cleaned = cleaned.replace(/^\+/, '');
    
    // Добавляем @c.us
    return cleaned + '@c.us';
  }

  getStatus() {
    return {
      isReady: this.isReady,
      hasQR: !!this.qrCode,
      qrCode: this.qrCode
    };
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
    }
  }
}

module.exports = new WhatsAppService();