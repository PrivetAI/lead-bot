// api/src/whatsapp/service.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const db = require('../database/connection');
const qrcodeTerminal = require('qrcode-terminal');
const HumanBehaviorSimulator = require('./humanBehavior');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.humanSimulator = new HumanBehaviorSimulator();
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
      const phoneNumber = contact.id.user || contact.number || message.from.split('@')[0];
      const waId = message.from;

      console.log('📩 Message from:', phoneNumber, ':', message.body);

      // Отправляем статус "онлайн"

      const normalizedPhone = phoneNumber.replace(/^\+/, '');
      await this.sendPresenceOnline();


      // ВРЕМЕННО: Сразу отправляем seen для тестирования
      try {
        await this.client.sendReadReceipt(message.from);
        console.log('✅ Sent seen immediately');
      } catch (e) {
        console.error('❌ sendSeen failed:', e);
      }
      // Симулируем человеческое поведение для отметки "просмотрено"
      // await this.humanSimulator.simulateMessageReading(waId, async () => {
      //   try {
      //     await chat.sendSeen();
      //     console.log('✅ Sent seen');
      //   } catch (e) {
      //     console.error('❌ sendSeen failed:', e);
      //   }
      // });

      // Работаем с данными
      let leadResult;
      try {
        leadResult = await db.query(
          'SELECT id, amocrm_id FROM leads WHERE phone = $1 OR wa_id = $2',
          [normalizedPhone, waId]
        );
      } catch (error) {
        console.error('Error querying lead:', error.message);
        leadResult = { rows: [] };
      }

      let leadId = null;
      let amocrmId = null;
      if (leadResult.rows.length > 0) {
        leadId = leadResult.rows[0].id;
        amocrmId = leadResult.rows[0].amocrm_id;
      }

      // Сохраняем сообщение в БД
      try {
        await db.query(
          `INSERT INTO chat_history (lead_id, phone, message, direction) 
           VALUES ($1, $2, $3, $4)`,
          [leadId, normalizedPhone, message.body, 'incoming']
        );
        console.log('💾 Message saved to DB');
      } catch (dbError) {
        console.error('Error saving to DB:', dbError);
      }

      // Отправляем в n8n
      await this.sendToN8n({
        phone: normalizedPhone,
        wa_id: waId,
        message: message.body,
        lead_id: leadId,
        amocrm_id: amocrmId,
        direction: 'incoming',
        contact_name: contact.name || contact.pushname || normalizedPhone,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  async sendMessage(waId, message, leadId = null, aiAgent = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp not ready');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(waId);
      
      // Отправляем статус "онлайн"
      await this.sendPresenceOnline();
      
      // Выполняем человеческое поведение
      const sentMessage = await this.humanSimulator.simulateMessageSending(
        '', // Пустая строка вместо последнего сообщения
        message,
        {
          sendTyping: async () => await this.sendTyping(formattedNumber),
          sendMessage: async () => await this.client.sendMessage(formattedNumber, message)
        }
      );
      
      console.log(`✅ Message sent to ${formattedNumber}`);
      
      // Сохраняем в БД
      await this.saveOutgoingMessage(formattedNumber, message, leadId, aiAgent);
      
      return { success: true, messageId: sentMessage.id };

    } catch (error) {
      console.error('Send error:', error);
      throw error;
    }
  }

  async saveOutgoingMessage(formattedNumber, message, leadId, aiAgent) {
    const phoneNumber = formattedNumber.replace('@c.us', '');
    
    try {
      let dbLeadId = null;
      
      if (!leadId) {
        const leadResult = await db.query(
          'SELECT id FROM leads WHERE phone = $1 OR phone = $2 OR wa_id = $3',
          [phoneNumber, '+' + phoneNumber, formattedNumber]
        );
        if (leadResult.rows.length > 0) {
          dbLeadId = leadResult.rows[0].id;
        }
      } else {
        // Проверяем как внутренний id
        let leadResult = await db.query('SELECT id FROM leads WHERE id = $1', [leadId]);
        
        if (leadResult.rows.length > 0) {
          dbLeadId = leadId;
        } else {
          // Проверяем как amocrm_id
          leadResult = await db.query('SELECT id FROM leads WHERE amocrm_id = $1', [leadId]);
          if (leadResult.rows.length > 0) {
            dbLeadId = leadResult.rows[0].id;
          }
        }
      }

      if (dbLeadId) {
        await db.query(
          `INSERT INTO chat_history (lead_id, phone, message, direction, ai_agent) 
           VALUES ($1, $2, $3, $4, $5)`,
          [dbLeadId, phoneNumber, message, 'outgoing', aiAgent]
        );
        console.log('💾 Outgoing message saved to DB');
      } else {
        console.warn(`⚠️ Lead not found for phone ${phoneNumber}, leadId ${leadId}`);
      }

    } catch (dbError) {
      console.error('Error saving outgoing message to DB:', dbError);
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
    
    if (!this.isReady) {
      throw new Error('WhatsApp not ready');
    }

    try {
      console.log('🎉 Отправка приветственного сообщения...');
      
      // Отправляем статус "онлайн"
      await this.sendPresenceOnline();
      
      // Используем симулятор для приветственного сообщения
      const sentMessage = await this.humanSimulator.simulateWelcomeMessage(
        message,
        {
          sendTyping: async () => await this.sendTyping(formattedNumber),
          sendMessage: async () => await this.client.sendMessage(formattedNumber, message)
        }
      );
      
      console.log(`✅ Welcome message sent to ${formattedNumber}`);
      
      // Сохраняем в БД
      await this.saveOutgoingMessage(formattedNumber, message, leadId, null);
      
      return { success: true, messageId: sentMessage.id };
      
    } catch (error) {
      console.error('Welcome message error:', error);
      throw error;
    }
  }

  async sendTyping(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      await chat.sendStateTyping();
    } catch (error) {
      console.error('Error sending typing:', error);
    }
  }

  async sendPresenceOnline() {
    try {
      await this.client.sendPresenceAvailable();
      console.log('👁️ Status: online');
    } catch (error) {
      console.error('❌ Failed to set presence:', error);
    }
  }

  async sendPresenceOffline() {
    try {
      await this.client.sendPresenceUnavailable();
      console.log('👁️ Status: offline');
    } catch (error) {
      console.error('❌ Failed to set offline presence:', error);
    }
  }

  formatPhoneNumber(phoneNumber) {
    let cleaned = String(phoneNumber).replace(/[^\d+]/g, '');
    
    if (String(phoneNumber).includes('@c.us')) {
      return String(phoneNumber);
    }
    
    cleaned = cleaned.replace(/^\+/, '');
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
      await this.sendPresenceOffline();
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
    }
  }
}

module.exports = new WhatsAppService();