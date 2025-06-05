const { TelegramApi } = require('telegram');
const { StringSession } = require('telegram/sessions');
const axios = require('axios');
const db = require('../database/connection');

class TelegramUserbot {
 constructor() {
  this.client = null;
  this.isReady = false;
  this.qrCode = null;
  this.retryAttempts = 3;
  this.retryDelay = 5000;
  this.qrGeneratedAt = null; // Добавить для отслеживания времени генерации
}


  async initialize() {
    const session = new StringSession(process.env.TELEGRAM_SESSION_STRING || '');
    this.client = new TelegramApi(session, parseInt(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH);
    
    await this.client.start({
      phoneNumber: process.env.TELEGRAM_PHONE,
      password: async () => process.env.TELEGRAM_PASSWORD,
      phoneCode: async () => process.env.TELEGRAM_CODE,
      onError: (err) => console.error('Userbot error:', err),
    });

    this.isConnected = true;
    this.setupHandlers();
    console.log('Telegram Userbot connected');
  }
  setupEventHandlers() {
  this.client.on('qr', (qr) => {
    this.qrCode = qr;
    this.qrGeneratedAt = new Date();
    console.log('WhatsApp QR code generated at:', this.qrGeneratedAt);
    console.log('QR Code:', qr);
    
    // Автоматически выводим QR-код в консоль в виде ASCII
    const qrcode = require('qrcode-terminal');
    qrcode.generate(qr, { small: true });
  })}
  setupHandlers() {
    this.client.addEventHandler(async (event) => {
      if (event.className === 'UpdateNewMessage' && event.message?.peerId?.userId) {
        await this.handleIncomingMessage(event.message);
      }
    });
  }

  async handleIncomingMessage(message) {
    try {
      const sender = await message.getSender();
      const chatId = message.peerId.userId.toString();
      
      await this.sendToN8n({
        chat_id: chatId,
        message: message.message,
        lead_id: null,
        tg_username: sender.username || null,
        tg_user_id: sender.id.toString(),
        direction: 'incoming'
      });

      await db.query(
        'INSERT INTO conversations (lead_id, platform, direction, message_type, content, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [null, 'telegram', 'incoming', 'user_message', message.message, JSON.stringify({
          chat_id: chatId,
          tg_username: sender.username,
          tg_user_id: sender.id.toString()
        })]
      );
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  async sendMessage(chatId, message, leadId) {
    try {
      await this.client.sendMessage(chatId, { message });
      
      await this.sendToN8n({
        chat_id: chatId,
        message,
        lead_id: leadId,
        direction: 'outgoing'
      });

      await db.query(
        'INSERT INTO conversations (lead_id, platform, direction, message_type, content, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [leadId, 'telegram', 'outgoing', 'userbot_message', message, JSON.stringify({ chat_id: chatId })]
      );

      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendToN8n(data) {
    try {
      await axios.post(`${process.env.N8N_BASE_URL || 'http://n8n:5678'}/webhook/telegram-userbot`, data);
    } catch (error) {
      console.error('Error sending to n8n:', error);
    }
  }
}

module.exports = new TelegramUserbot();

