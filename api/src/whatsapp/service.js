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
    this.processingChats = new Set(); // Для отслеживания обрабатываемых чатов
    this.messageQueue = new Map(); // Очередь сообщений по чатам
  }

  async initialize() {
    try {
      console.log('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'lead-bot',
          dataPath: './sessions'
        }),
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials'
          ],
          defaultViewport: null
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

  // Метод для отметки ВСЕХ сообщений в чате как прочитанных
  async markAllChatMessagesAsRead(chat) {
    console.log('\n🔍 === MARK ALL CHAT MESSAGES AS READ ===');
    console.log(`📱 Chat ID: ${chat.id._serialized}`);
    
    try {
      // Получаем актуальное состояние чата
      const freshChat = await this.client.getChatById(chat.id._serialized);
      console.log(`📊 Total unread: ${freshChat.unreadCount}`);
      
      if (freshChat.unreadCount === 0) {
        console.log('✅ Already all read');
        return true;
      }
      
      // Метод 1: Множественный sendSeen
      console.log('📌 Multiple sendSeen...');
      for (let i = 0; i < 5; i++) {
        try {
          await freshChat.sendSeen();
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error(`❌ sendSeen ${i+1} failed:`, e.message);
        }
      }
      
      // Метод 2: Прямая манипуляция Store для всего чата
      console.log('📌 Force clear all unread...');
      try {
        const page = this.client.pupPage;
        if (page) {
          await page.evaluate(async (chatId) => {
            try {
              const Store = window.Store;
              if (!Store) return;
              
              const chat = Store.Chat.get(chatId);
              if (!chat) return;
              
              // Сбрасываем все счетчики
              chat.unreadCount = 0;
              chat.hasUnread = false;
              chat.markedUnread = false;
              
              // Получаем ВСЕ сообщения
              const allMessages = chat.msgs.models;
              console.log(`Found ${allMessages.length} messages in chat`);
              
              // Отмечаем ВСЕ как прочитанные
              for (const msg of allMessages) {
                if (msg && !msg.isSentByMe && msg.ack < 2) {
                  msg.ack = 2;
                }
              }
              
              // Множественные вызовы для надежности
              for (let i = 0; i < 3; i++) {
                if (chat.sendSeen) await chat.sendSeen();
                await new Promise(r => setTimeout(r, 200));
              }
              
              // Обновляем статус чата
              if (Store.ReadStatus && Store.ReadStatus.sendReadStatus) {
                await Store.ReadStatus.sendReadStatus(chat);
              }
              
              // Принудительное обновление UI
              if (chat.forceUpdateUI) chat.forceUpdateUI();
              
            } catch (e) {
              console.error('Store error:', e);
            }
          }, freshChat.id._serialized);
          
          console.log('✅ Force clear done');
        }
      } catch (e) {
        console.error('❌ Page evaluate failed:', e.message);
      }
      
      // Финальная проверка
      await new Promise(r => setTimeout(r, 2000));
      const finalChat = await this.client.getChatById(chat.id._serialized);
      console.log(`📊 Final unread count: ${finalChat.unreadCount} ${finalChat.unreadCount === 0 ? '✅' : '❌'}`);
      
      return finalChat.unreadCount === 0;
      
    } catch (error) {
      console.error('❌ markAllChatMessagesAsRead error:', error);
      return false;
    }
  }



  // Метод для отметки всех сообщений в чате
  async markChatAsRead(chatId) {
    console.log(`\n🔍 === MARK CHAT AS READ: ${chatId} ===`);
    
    try {
      const chat = await this.client.getChatById(chatId);
      console.log(`📊 Unread count: ${chat.unreadCount}`);
      
      if (chat.unreadCount === 0) {
        console.log('✅ Already all read');
        return true;
      }

      // Комбинированный подход
      console.log('🔄 Applying combined approach...');
      
      // 1. Основной sendSeen
      await chat.sendSeen();
      await new Promise(r => setTimeout(r, 500));
      
      // 2. Client sendSeen с разными форматами ID
      await this.client.sendSeen(chatId);
      await new Promise(r => setTimeout(r, 500));
      
      // 3. Пробуем с chat.id._serialized
      if (chat.id && chat.id._serialized) {
        await this.client.sendSeen(chat.id._serialized);
        await new Promise(r => setTimeout(r, 500));
      }
      
      // 4. Проверка и принудительная отметка если нужно
      const isRead = await this.verifyReadStatus(chatId);
      if (!isRead) {
        await this.forceMarkAsRead(chat);
      }
      
      return await this.verifyReadStatus(chatId);
      
    } catch (error) {
      console.error('❌ markChatAsRead failed:', error);
      return false;
    }
  }

  // Проверка статуса прочтения
  async verifyReadStatus(chatId) {
    try {
      await new Promise(r => setTimeout(r, 1500));
      const chat = await this.client.getChatById(chatId);
      const isRead = chat.unreadCount === 0;
      console.log(`📊 Verification: ${chat.unreadCount} unread ${isRead ? '✅' : '❌'}`);
      return isRead;
    } catch (e) {
      console.error('❌ verifyReadStatus failed:', e.message);
      return false;
    }
  }

  async handleIncomingMessage(message) {
    try {
      if (message.isStatus || message.broadcast) return;

      const chat = await message.getChat();
      if (chat.isGroup) return;

      const waId = message.from;
      
      // Добавляем сообщение в очередь
      if (!this.messageQueue.has(waId)) {
        this.messageQueue.set(waId, []);
      }
      this.messageQueue.get(waId).push(message);
      
      // Если чат уже обрабатывается - выходим
      if (this.processingChats.has(waId)) {
        console.log(`⏳ Chat ${waId} already processing, message queued`);
        return;
      }
      
      // Начинаем обработку всех сообщений в очереди для этого чата
      await this.processMessageQueue(waId);
      
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }
  
  async processMessageQueue(waId) {
    // Помечаем чат как обрабатываемый
    this.processingChats.add(waId);
    
    try {
      while (this.messageQueue.has(waId) && this.messageQueue.get(waId).length > 0) {
        const messages = this.messageQueue.get(waId);
        const message = messages.shift(); // Берем первое сообщение из очереди
        
        if (!message) continue;
        
        console.log(`\n📦 Processing queued message (${messages.length} left in queue)`);
        
        // Обрабатываем сообщение
        await this.processSingleMessage(message);
        
        // Небольшая пауза между сообщениями
        if (messages.length > 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      // Удаляем пустую очередь
      this.messageQueue.delete(waId);
      
    } catch (error) {
      console.error('❌ Error processing message queue:', error);
    } finally {
      // Убираем чат из обрабатываемых
      this.processingChats.delete(waId);
    }
  }
  
  async processSingleMessage(message) {
    try {
      const chat = await message.getChat();
      const contact = await message.getContact();
      const phoneNumber = contact.id.user || contact.number || message.from.split('@')[0];
      const waId = message.from;

      console.log('\n📩 === INCOMING MESSAGE ===');
      console.log(`👤 From: ${phoneNumber}`);
      console.log(`💬 Text: ${message.body}`);
      console.log(`🆔 WA ID: ${waId}`);

      await this.sendPresenceOnline();

      const normalizedPhone = phoneNumber.replace(/^\+/, '');

      // Симуляция чтения с новым методом
      await this.humanSimulator.simulateMessageReading(waId, async () => {
        // Отмечаем ВСЕ сообщения в чате как прочитанные
        await this.markAllChatMessagesAsRead(chat);
      }, message.body);

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
      console.error('❌ Error processing single message:', error);
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
      console.log(`💬 Message length: ${message.length} chars`);

      // Отправляем статус "онлайн"
      await this.sendPresenceOnline();

      // Выполняем человеческое поведение
      const sentMessage = await this.humanSimulator.simulateMessageSending(
        message,
        {
          sendTyping: async () => await this.sendTyping(formattedNumber),
          sendMessage: async () => await this.client.sendMessage(formattedNumber, message)
        }
      );

      console.log(`✅ Message sent successfully`);

      // Сохраняем в БД
      await this.saveOutgoingMessage(formattedNumber, message, leadId, aiAgent);

      return { success: true, messageId: sentMessage.id };

    } catch (error) {
      console.error('❌ Send error:', error);
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
      console.log('\n🎉 === WELCOME MESSAGE ===');
      console.log(`📱 To: ${formattedNumber}`);

      // Отправляем статус "онлайн"
      await this.sendPresenceOnline();

      // Используем симулятор для приветственного сообщения
      const sentMessage = await this.humanSimulator.simulateMessageSending(
        message,
        {
          sendTyping: async () => await this.sendTyping(formattedNumber),
          sendMessage: async () => await this.client.sendMessage(formattedNumber, message)
        }
      );

      console.log(`✅ Welcome message sent`);

      // Сохраняем в БД
      await this.saveOutgoingMessage(formattedNumber, message, leadId, null);

      return { success: true, messageId: sentMessage.id };

    } catch (error) {
      console.error('❌ Welcome message error:', error);
      throw error;
    }
  }

  async sendTyping(waId) {
    try {
      const chat = await this.client.getChatById(waId);
      await chat.sendStateTyping();
      console.log('⌨️ Typing indicator sent');
    } catch (error) {
      console.error('❌ Error sending typing:', error.message);
    }
  }

  async sendPresenceOnline() {
    try {
      await this.client.sendPresenceAvailable();
      console.log('👁️ Status: online');
    } catch (error) {
      console.error('❌ Failed to set presence:', error.message);
    }
  }

  async sendPresenceOffline() {
    try {
      await this.client.sendPresenceUnavailable();
      console.log('👁️ Status: offline');
    } catch (error) {
      console.error('❌ Failed to set offline presence:', error.message);
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

  // Утилита для отметки всех непрочитанных чатов
  async markAllUnreadChats() {
    try {
      console.log('\n🔍 === MARK ALL UNREAD CHATS ===');
      const chats = await this.client.getChats();
      const unreadChats = chats.filter(chat => chat.unreadCount > 0);
      
      console.log(`📋 Found ${unreadChats.length} unread chats`);
      
      let success = 0;
      let failed = 0;
      
      for (const chat of unreadChats) {
        const result = await this.markChatAsRead(chat.id._serialized);
        if (result) success++;
        else failed++;
      }
      
      console.log(`\n📊 Results: ${success} success, ${failed} failed`);
      return { success, failed };
      
    } catch (error) {
      console.error('❌ markAllUnreadChats failed:', error);
      return { success: 0, failed: 0 };
    }
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