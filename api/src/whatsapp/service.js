const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const db = require('../database/connection');
const qrcodeTerminal = require('qrcode-terminal');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.retryAttempts = 3;
    this.retryDelay = 5000;
  }

  async initialize() {
    try {
      console.log('Initializing WhatsApp client...');
      
      // Проверяем, отключен ли WhatsApp
      if (process.env.DISABLE_WHATSAPP === 'true') {
        console.log('WhatsApp is disabled by environment variable');
        return;
      }
      
      this.client = new Client({
        authStrategy: new LocalAuth({ 
          clientId: 'lead-bot',
          dataPath: '/app/sessions'
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
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
      console.log('\n===========================================');
      console.log('📱 WhatsApp QR Code Generated!');
      console.log('Scan this QR code with WhatsApp on your phone:');
      console.log('===========================================\n');
      
      // Генерируем QR-код в терминале
      qrcodeTerminal.generate(qr, { small: true });
      
      console.log('\n===========================================');
      console.log('Steps to connect:');
      console.log('1. Open WhatsApp on your phone');
      console.log('2. Go to Settings → Linked Devices');
      console.log('3. Tap "Link a Device"');
      console.log('4. Scan this QR code');
      console.log('===========================================\n');
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.qrCode = null;
      console.log('\n✅ WhatsApp client is ready and connected!');
      console.log('===========================================\n');
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp client authenticated successfully');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failure:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️  WhatsApp client disconnected:', reason);
      this.isReady = false;
      // Попытка переподключения
      setTimeout(() => this.reconnect(), 10000);
    });

    this.client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });

    this.client.on('message_create', async (message) => {
      // Обработка исходящих сообщений для логирования
      if (message.fromMe) {
        await this.logOutgoingMessage(message);
      }
    });
  }

  async reconnect() {
    console.log('Attempting to reconnect WhatsApp...');
    try {
      await this.client.destroy();
      await this.initialize();
    } catch (error) {
      console.error('Reconnection failed:', error);
      setTimeout(() => this.reconnect(), 30000);
    }
  }

  async handleIncomingMessage(message) {
    try {
      // Игнорируем статусные и групповые сообщения
      if (message.from === 'status@broadcast' || message.isGroupMsg) return;

      console.log('Incoming message from:', message.from, 'Content:', message.body);

      const contact = await message.getContact();
      
      // Проверяем, есть ли лид с таким номером
      const leadResult = await db.query(
        'SELECT * FROM leads WHERE wa_id = $1 OR phone = $2',
        [message.from, contact.number]
      );

      let leadId = null;
      if (leadResult.rows.length > 0) {
        leadId = leadResult.rows[0].id;
      }

      // Сохраняем сообщение в БД
      await this.saveMessage({
        wa_id: message.from,
        wa_phone: contact.number,
        message: message.body,
        message_type: message.type,
        timestamp: message.timestamp
      }, 'incoming', leadId);

      // Отправляем в n8n для обработки AI
      await this.sendToN8n({
        wa_id: message.from,
        wa_phone: contact.number,
        message: message.body,
        lead_id: leadId,
        direction: 'incoming',
        contact_name: contact.name || contact.pushname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
    }
  }

  async logOutgoingMessage(message) {
    try {
      const leadResult = await db.query(
        'SELECT id FROM leads WHERE wa_id = $1',
        [message.to]
      );

      const leadId = leadResult.rows.length > 0 ? leadResult.rows[0].id : null;

      await this.saveMessage({
        wa_id: message.to,
        message: message.body,
        message_type: message.type,
        timestamp: message.timestamp
      }, 'outgoing', leadId);
    } catch (error) {
      console.error('Error logging outgoing message:', error);
    }
  }

  async sendMessage(waId, message, leadId = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    let attempts = 0;
    while (attempts < this.retryAttempts) {
      try {
        // Форматируем номер если нужно
        const chatId = waId.includes('@c.us') ? waId : `${waId}@c.us`;
        
        await this.client.sendMessage(chatId, message);
        console.log(`Message sent to ${chatId}`);

        // Сохраняем в БД
        await this.saveMessage({
          wa_id: chatId,
          message,
          message_type: 'text'
        }, 'outgoing', leadId);

        return { success: true };
      } catch (error) {
        attempts++;
        console.error(`Attempt ${attempts} failed:`, error.message);
        
        if (attempts < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  async saveMessage(messageData, direction, leadId = null) {
    try {
      await db.query(
        `INSERT INTO conversations 
         (lead_id, platform, direction, message_type, content, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
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
      console.error('Error saving message to DB:', error);
    }
  }

  async sendToN8n(data) {
    try {
      const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/whatsapp-incoming';
      await axios.post(n8nUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log('Message sent to n8n workflow');
    } catch (error) {
      console.error('Error sending to n8n:', error.message);
    }
  }

  async sendWelcomeMessage(waId, leadData) {
    const templates = {
      default: `Здравствуйте, ${leadData.name}! 👋


Я ваш персональный консультант и готов помочь подобрать оптимальное решение для вашей компании.

Расскажите, пожалуйста:
• Какие процессы вы хотели бы автоматизировать?
• Сколько клиентов обрабатываете в месяц?
• Есть ли у вас CRM-система?

Буду рад ответить на любые вопросы!`,
    };

    const template = templates[leadData.source] || templates.default;
    await this.sendMessage(waId, template, leadData.id);
  }

  async sendTyping(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      await chat.sendStateTyping();
    } catch (error) {
      console.error('Error sending typing state:', error);
    }
  }

  async sendSeen(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      await chat.sendSeen();
    } catch (error) {
      console.error('Error sending seen state:', error);
    }
  }
}

module.exports = new WhatsAppService();