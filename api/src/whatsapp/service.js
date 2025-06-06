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

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'lead-bot',
          dataPath: './sessions' // Изменено на относительный путь
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
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
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
      this.isReady = false;
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

    // Добавлено обработка ошибок загрузки
    this.client.on('loading_screen', (percent, message) => {
      console.log('Loading...', percent, message);
    });

    // Обработка изменения состояния
    this.client.on('change_state', state => {
      console.log('State changed:', state);
    });
  }

  async reconnect() {
    console.log('Attempting to reconnect WhatsApp...');
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
      // Игнорируем статусные сообщения
      if (message.isStatus || message.broadcast) return;

      // Проверяем групповые сообщения используя правильное свойство
      const chat = await message.getChat();
      if (chat.isGroup) return;

      console.log('Incoming message from:', message.from, 'Content:', message.body);

      const contact = await message.getContact();
      
      // Получаем номер телефона правильным способом
      const phoneNumber = contact.id.user || contact.number;

      // Проверяем, есть ли лид с таким номером (только по phone)
      const leadResult = await db.query(
        'SELECT * FROM leads WHERE phone = $1',
        [phoneNumber]
      );

      let leadId = null;
      if (leadResult.rows.length > 0) {
        leadId = leadResult.rows[0].id;
      }

      // Сохраняем сообщение в БД
      await this.saveMessage({
        message: message.body,
        message_type: message.type,
        timestamp: message.timestamp,
        has_media: message.hasMedia
      }, 'incoming', leadId);

      // Отправляем в n8n для обработки AI
      await this.sendToN8n({
        phone: phoneNumber,
        message: message.body,
        lead_id: leadId,
        direction: 'incoming',
        contact_name: contact.name || contact.pushname || phoneNumber,
        timestamp: new Date().toISOString(),
        has_media: message.hasMedia,
        message_type: message.type
      });

      // Отмечаем сообщение как прочитанное
      await this.sendSeen(message.from);

    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
    }
  }

  async logOutgoingMessage(message) {
    try {
      const contact = await this.client.getContactById(message.to);
      const phoneNumber = contact.id.user || contact.number;
      
      const leadResult = await db.query(
        'SELECT id FROM leads WHERE phone = $1',
        [phoneNumber]
      );

      const leadId = leadResult.rows.length > 0 ? leadResult.rows[0].id : null;

      await this.saveMessage({
        message: message.body,
        message_type: message.type,
        timestamp: message.timestamp,
        has_media: message.hasMedia
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
        // Показываем статус "печатает"
        await this.sendTyping(waId);
        
        // Небольшая задержка для естественности
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Отправляем сообщение
        const sentMessage = await this.client.sendMessage(waId, message);
        console.log(`Message sent to ${waId}`);

        // Сохраняем в БД
        await this.saveMessage({
          message,
          message_type: 'text',
          timestamp: sentMessage.timestamp
        }, 'outgoing', leadId);

        return { success: true, messageId: sentMessage.id };
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
        `INSERT INTO conversations (lead_id, direction, content) 
         VALUES ($1, $2, $3)`,
        [leadId, direction, messageData.message]
      );
    } catch (error) {
      console.error('Error saving message to DB:', error);
    }
  }

  async sendToN8n(data) {
    try {
      const n8nUrl = process.env.N8N_WEBHOOK_URL + '/whatsapp-userbot-webhook';
      console.log('Sending to n8n:', n8nUrl);
      
      await axios.post(n8nUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log('Message sent to n8n workflow');
    } catch (error) {
      console.error('Error sending to n8n:', error.message);
    }
  }

  async sendWelcomeMessage(phoneNumber, message = '', lead_id) {
    console.log('=== DEBUG: Welcome Message ===');
    console.log('phoneNumber:', phoneNumber, 'type:', typeof phoneNumber);
    console.log('lead_id:', lead_id, 'type:', typeof lead_id);
    console.log('message:', message, 'type:', typeof message);

    // Форматируем номер телефона для WhatsApp
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    return await this.sendMessage(formattedNumber, message, lead_id);
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

  // Новые методы для расширенной функциональности

  async sendMedia(waId, mediaPath, caption = '', leadId = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp client not ready');
    }

    try {
      const media = MessageMedia.fromFilePath(mediaPath);
      const sentMessage = await this.client.sendMessage(waId, media, { caption });
      
      await this.saveMessage({
        message: caption || '[Media]',
        message_type: 'media',
        timestamp: sentMessage.timestamp
      }, 'outgoing', leadId);

      return { success: true, messageId: sentMessage.id };
    } catch (error) {
      console.error('Error sending media:', error);
      throw error;
    }
  }

  async getContactInfo(waId) {
    try {
      const contact = await this.client.getContactById(waId);
      return {
        number: contact.number,
        name: contact.name || contact.pushname,
        isMyContact: contact.isMyContact,
        profilePicUrl: await contact.getProfilePicUrl()
      };
    } catch (error) {
      console.error('Error getting contact info:', error);
      return null;
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Удаляем все нецифровые символы
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Добавляем @c.us для WhatsApp ID
    if (!cleaned.includes('@')) {
      cleaned = cleaned + '@c.us';
    }
    
    return cleaned;
  }

  async saveMedia(message) {
    try {
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        // Здесь можно добавить логику сохранения медиа в файловую систему или облако
        // Возвращаем путь или URL сохраненного файла
        return null; // Заглушка
      }
    } catch (error) {
      console.error('Error saving media:', error);
      return null;
    }
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