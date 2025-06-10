// api/src/whatsapp/typingMonitor.js
class TypingMonitor {
  constructor() {
    this.typingStates = new Map(); // waId -> {isTyping, lastUpdate, duration}
    this.debugMode = process.env.NODE_ENV === 'development';
  }

  // Обновление статуса печати с детальной диагностикой
  updateTypingState(waId, isTyping) {
    const now = Date.now();
    const phoneNumber = waId.split('@')[0];
    
    if (!this.typingStates.has(waId)) {
      this.typingStates.set(waId, {
        isTyping: false,
        lastUpdate: now,
        startTime: null,
        totalTypingTime: 0,
        typingEvents: 0
      });
    }
    
    const state = this.typingStates.get(waId);
    const wasTyping = state.isTyping;
    
    // Если статус изменился
    if (wasTyping !== isTyping) {
      if (this.debugMode) {
        console.log(`🔄 [${phoneNumber}] Typing status: ${wasTyping} → ${isTyping}`);
      }
      
      if (isTyping) {
        // Начал печатать
        state.startTime = now;
        state.typingEvents++;
        console.log(`⌨️ [${phoneNumber}] Started typing (event #${state.typingEvents})`);
      } else {
        // Перестал печатать
        if (state.startTime) {
          const duration = now - state.startTime;
          state.totalTypingTime += duration;
          console.log(`⏹️ [${phoneNumber}] Stopped typing (duration: ${Math.round(duration/1000)}s, total: ${Math.round(state.totalTypingTime/1000)}s)`);
        }
        state.startTime = null;
      }
      
      state.isTyping = isTyping;
      state.lastUpdate = now;
    }
    
    return { wasTyping, isTyping, changed: wasTyping !== isTyping };
  }
  
  // Получение текущего статуса
  getTypingState(waId) {
    return this.typingStates.get(waId) || {
      isTyping: false,
      lastUpdate: Date.now(),
      startTime: null,
      totalTypingTime: 0,
      typingEvents: 0
    };
  }
  
  // Проверка устаревших статусов (автоочистка)
  cleanupStaleStates(maxAge = 300000) { // 5 минут
    const now = Date.now();
    let cleaned = 0;
    
    for (const [waId, state] of this.typingStates.entries()) {
      if (now - state.lastUpdate > maxAge) {
        this.typingStates.delete(waId);
        cleaned++;
      }
    }
    
    if (cleaned > 0 && this.debugMode) {
      console.log(`🧹 Cleaned up ${cleaned} stale typing states`);
    }
    
    return cleaned;
  }
  
  // Статистика по всем контактам
  getOverallStats() {
    const stats = {
      totalContacts: this.typingStates.size,
      currentlyTyping: 0,
      totalTypingEvents: 0,
      totalTypingTime: 0,
      contacts: []
    };
    
    for (const [waId, state] of this.typingStates.entries()) {
      const phoneNumber = waId.split('@')[0];
      
      if (state.isTyping) {
        stats.currentlyTyping++;
      }
      
      stats.totalTypingEvents += state.typingEvents;
      stats.totalTypingTime += state.totalTypingTime;
      
      // Добавляем активное время печати если сейчас печатает
      let currentSession = 0;
      if (state.isTyping && state.startTime) {
        currentSession = Date.now() - state.startTime;
      }
      
      stats.contacts.push({
        phone: phoneNumber,
        isTyping: state.isTyping,
        currentSessionTime: Math.round(currentSession / 1000),
        totalTypingTime: Math.round((state.totalTypingTime + currentSession) / 1000),
        typingEvents: state.typingEvents,
        lastUpdate: new Date(state.lastUpdate).toLocaleTimeString()
      });
    }
    
    stats.totalTypingTime = Math.round(stats.totalTypingTime / 1000);
    
    return stats;
  }
  
  // Вывод детальной статистики в консоль
  printStats() {
    const stats = this.getOverallStats();
    
    console.log('\n📊 === TYPING MONITOR STATS ===');
    console.log(`👥 Total contacts: ${stats.totalContacts}`);
    console.log(`⌨️ Currently typing: ${stats.currentlyTyping}`);
    console.log(`📈 Total typing events: ${stats.totalTypingEvents}`);
    console.log(`⏱️ Total typing time: ${stats.totalTypingTime}s`);
    
    if (stats.contacts.length > 0) {
      console.log('\n📱 Contact details:');
      stats.contacts.forEach(contact => {
        const status = contact.isTyping ? '⌨️ TYPING' : '⏸️ idle';
        const current = contact.isTyping ? ` (${contact.currentSessionTime}s)` : '';
        console.log(`  ${contact.phone}: ${status}${current} | Total: ${contact.totalTypingTime}s | Events: ${contact.typingEvents}`);
      });
    }
    
    console.log('================================\n');
  }
  
  // Включение/выключение debug режима
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🐛 Debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  
  // Сброс статистики для конкретного контакта
  resetContactStats(waId) {
    if (this.typingStates.has(waId)) {
      this.typingStates.delete(waId);
      console.log(`🔄 Reset stats for ${waId.split('@')[0]}`);
      return true;
    }
    return false;
  }
  
  // Полная очистка всей статистики
  clearAllStats() {
    const count = this.typingStates.size;
    this.typingStates.clear();
    console.log(`🧹 Cleared stats for ${count} contacts`);
    return count;
  }
}

module.exports = TypingMonitor;