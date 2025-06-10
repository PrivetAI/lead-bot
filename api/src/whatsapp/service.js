const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const db = require('../database/connection');
const qrcodeTerminal = require('qrcode-terminal');
const HumanBehaviorSimulator = require('./humanBehavior');
const MessageBuffer = require('./messageBuffer');
const fs = require('fs');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.humanSimulator = new HumanBehaviorSimulator();
    this.messageBuffer = new MessageBuffer();
  }

  async cleanupSessions() {
    try {
      console.log('🧹 Starting cleanup...');
      const { exec } = require('child_process');
      
      const killCommands = [
        'pkill -9 -f chrome',
        'pkill -9 -f chromium',
        'pkill -9 -f puppeteer'
      ];
      
      for (const cmd of killCommands) {
        try {
          await new Promise((resolve) => {
            exec(cmd, () => resolve());
          });
        } catch (err) {}
      }
      
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
  }

  async initialize() {
    console.log('Initializing WhatsApp client…');
    
    await this.cleanupSessions();

    const sessionPath = path.resolve(__dirname, '../../sessions');
    
    // Ensure session directory exists with proper permissions
    if (!fs.existsSync(sessionPath)) {
      try {
        fs.mkdirSync(sessionPath, { recursive: true, mode: 0o777 });
      } catch (error) {
        console.error('Failed to create sessions directory:', error);
      }
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'lead-bot',
        dataPath: sessionPath
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--single-process',
          '--no-zygote'
        ],
        timeout: 90000,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
      }
    });

    this.setupEventHandlers();
    
    try {
      await this.client.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp client:', error.message);
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
      console.log('🔄 Attempting to reconnect...');
      if (this.client) {
        await this.client.destroy();
      }
      await this.cleanupSessions();
      await new Promise(r => setTimeout(r, 5000));
      await this.initialize();
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message);
      setTimeout(() => this.reconnect(), 30000);
    }
  }

  async handleIncomingMessage(message) {
    try {
      if (message.isStatus || message.broadcast || message.fromMe) return;

      const chat = await message.getChat();
      if (chat.isGroup) return;

      const waId = message.from;
      console.log(`\n📩 Новое сообщение от ${waId}`);

      // Mark as read immediately
      await this.markMessagesAsRead(chat);

      this.messageBuffer.setCallback(waId, async (messages) => {
        await this.processMessageBatch(waId, messages);
      });

      this.messageBuffer.addMessage(waId, message);

    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  async processMessageBatch(waId, messages) {
    try {
      const chat = await messages[0].getChat();
      const contact = await messages[0].getContact();
      const phoneNumber = contact.id.user || contact.number || waId.split('@')[0];
      const normalizedPhone = phoneNumber.replace(/^\+/, '');
      
      console.log(`\n📦 === ОБРАБОТКА БАТЧА ===`);
      console.log(`👤 От: ${phoneNumber}`);
      console.log(`📨 Сообщений: ${messages.length}`);
      
      const allTexts = messages.map(m => m.body);
      const combinedText = allTexts.join('\n');
      console.log(`💬 Объединенный текст:\n${combinedText}`);
      
      let leadId = null;
      let amocrmId = null;
      
      try {
        const leadResult = await db.query(
          'SELECT id, amocrm_id FROM leads WHERE phone = $1 OR wa_id = $2',
          [normalizedPhone, waId]
        );
        
        if (leadResult.rows.length > 0) {
          leadId = leadResult.rows[0].id;
          amocrmId = leadResult.rows[0].amocrm_id;
        }
      } catch (error) {
        console.error('Error querying lead:', error.message);
      }
      
      for (const msg of messages) {
        try {
          await db.query(
            `INSERT INTO chat_history (lead_id, phone, message, direction) 
             VALUES ($1, $2, $3, $4)`,
            [leadId, normalizedPhone, msg.body, 'incoming']
          );
        } catch (dbError) {
          console.error('Error saving message to DB:', dbError.message);
        }
      }
      
      console.log('💾 Сообщения сохранены в БД');
      
      await this.sendToN8n({
        phone: normalizedPhone,
        wa_id: waId,
        messages: allTexts,
        combined_text: combinedText,
        message_count: messages.length,
        lead_id: leadId,
        amocrm_id: amocrmId,
        direction: 'incoming',
        contact_name: contact.name || contact.pushname || normalizedPhone,
        timestamp: new Date().toISOString()
      });
      
      console.log('📤 Отправлено в n8n для обработки AI');
      
    } catch (error) {
      console.error('❌ Error processing message batch:', error);
    }
  }

  async markMessagesAsRead(chat) {
    try {
      // В whatsapp-web.js v1.30.0 используется sendSeen() для отметки как прочитанное
      await chat.sendSeen();
      console.log('✅ Messages marked as read');
      return true;
    } catch (error) {
      console.error('❌ Failed to mark as read:', error.message);
      return false;
    }
  }

  async sendMessage(waId, message, leadId = null, aiAgent = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp not ready');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(waId);
      console.log(`\n📤 === SENDING MESSAGE ===`);
      console.log(`📱 To: ${formattedNumber}`);

      const sentMessage = await this.humanSimulator.simulateMessageSending(
        message,
        {
          sendTyping: async () => await this.sendTypingState(formattedNumber),
          sendMessage: async () => await this.client.sendMessage(formattedNumber, message)
        }
      );

      console.log(`✅ Message sent successfully`);
      await this.saveOutgoingMessage(formattedNumber, message, leadId, aiAgent);

      return { success: true, messageId: sentMessage.id };

    } catch (error) {
      console.error('❌ Send error:', error);
      throw error;
    }
  }

  async sendTypingState(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      // В whatsapp-web.js v1.30.0 используется sendStateTyping()
      await chat.sendStateTyping();
      console.log('⌨️ Typing state sent');
      
      // Остановка typing через несколько секунд
      setTimeout(async () => {
        try {
          await chat.clearState();
        } catch (err) {
          // Игнорируем ошибки очистки состояния
        }
      }, 5000);
    } catch (error) {
      console.error('❌ Typing state error:', error.message);
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
        let leadResult = await db.query('SELECT id FROM leads WHERE id = $1', [leadId]);

        if (leadResult.rows.length > 0) {
          dbLeadId = leadId;
        } else {
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
      console.log('\n🎉 === WELCOME MESSAGE ===');
      console.log(`📱 To: ${formattedNumber}`);

      const sentMessage = await this.humanSimulator.simulateMessageSending(
        message,
        {
          sendTyping: async () => await this.sendTypingState(formattedNumber),
          sendMessage: async () => await this.client.sendMessage(formattedNumber, message)
        }
      );

      console.log(`✅ Welcome message sent`);
      await this.saveOutgoingMessage(formattedNumber, message, leadId, null);

      return { success: true, messageId: sentMessage.id };

    } catch (error) {
      console.error('❌ Welcome message error:', error);
      throw error;
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
    try {
      console.log('🛑 Destroying WhatsApp client...');
      if (this.client) {
        await this.client.destroy();
        this.client = null;
        this.isReady = false;
      }
      await this.cleanupSessions();
      console.log('✅ WhatsApp client destroyed');
    } catch (error) {
      console.error('❌ Error destroying client:', error.message);
    }
  }
}

module.exports = new WhatsAppService();