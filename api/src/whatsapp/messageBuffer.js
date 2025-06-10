// api/src/whatsapp/messageBuffer.js
class MessageBuffer {
  constructor() {
    this.buffers = new Map();
    this.WAIT_TIME = 8000; // 8 секунд ожидания
    this.CHECK_INTERVAL = 1000;
  }

  addMessage(waId, message) {
    if (!this.buffers.has(waId)) {
      this.buffers.set(waId, {
        messages: [],
        timer: null,
        lastActivity: Date.now()
      });
    }
    
    const buffer = this.buffers.get(waId);
    buffer.messages.push(message);
    buffer.lastActivity = Date.now();
    
    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }
    
    this.startTimer(waId);
  }
  
  startTimer(waId) {
    const buffer = this.buffers.get(waId);
    if (!buffer) return;
    
    buffer.timer = setTimeout(() => {
      this.checkAndFlush(waId);
    }, this.CHECK_INTERVAL);
  }
  
  checkAndFlush(waId) {
    const buffer = this.buffers.get(waId);
    if (!buffer || buffer.messages.length === 0) return;
    
    const timeSinceLastActivity = Date.now() - buffer.lastActivity;
    
    if (timeSinceLastActivity >= this.WAIT_TIME) {
      console.log(`✅ Отправляем ${buffer.messages.length} сообщений после ${Math.round(timeSinceLastActivity/1000)}с`);
      this.flush(waId);
    } else {
      console.log(`⏳ Ждем... (${Math.round(timeSinceLastActivity/1000)}с)`);
      this.startTimer(waId);
    }
  }
  
  flush(waId) {
    const buffer = this.buffers.get(waId);
    if (!buffer) return;
    
    clearTimeout(buffer.timer);
    const messages = [...buffer.messages];
    const callback = buffer.callback;
    
    this.buffers.delete(waId);
    
    if (callback) {
      callback(messages);
    }
  }
  
  setCallback(waId, callback) {
    if (!this.buffers.has(waId)) {
      this.buffers.set(waId, {
        messages: [],
        timer: null,
        lastActivity: Date.now()
      });
    }
    this.buffers.get(waId).callback = callback;
  }
}

module.exports = MessageBuffer;