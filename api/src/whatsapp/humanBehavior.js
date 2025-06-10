// api/src/whatsapp/humanBehavior.js
class HumanBehaviorSimulator {
  constructor() {
    this.delays = {
      beforeTyping: { min: 2000, max: 5000 },
      afterTyping: { min: 500, max: 1500 },
      viewMessage: { min: 1000, max: 3000 }
    };
    
    this.readingSpeed = 250;
    this.typingSpeed = 20; // Реальная скорость ~6-8 символов в секунду
  }
  
  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  calculateReadingTime(text) {
    if (!text) return 0;
    
    const chars = text.length;
    const baseTime = (chars / this.readingSpeed) * 1000;
    const variance = baseTime * 0.3;
    const readingTime = baseTime + this.random(-variance, variance);
    
    return Math.max(300, Math.min(readingTime, 5000));
  }
  
  calculateTypingTime(text) {
    const chars = text.length;
    const baseTime = (chars / this.typingSpeed) * 1000;
    const variance = baseTime * 0.25;
    const typingTime = baseTime + this.random(-variance, variance);
    
    return Math.max(1000, typingTime);
  }
  
  async simulateMessageSending(outgoingMessage, callbacks) {
    console.log('🎭 Имитация человеческого поведения...');
    
    const thinkingTime = this.random(this.delays.beforeTyping.min, this.delays.beforeTyping.max);
    console.log(`  💭 Обдумывание (${Math.round(thinkingTime/1000)}с)`);
    await new Promise(resolve => setTimeout(resolve, thinkingTime));
    
    console.log('  ⌨️ Начинаем печатать');
    await callbacks.sendTyping();
    
    const typingTime = this.calculateTypingTime(outgoingMessage);
    console.log(`  ⌨️ Печать ${outgoingMessage.length} символов (${Math.round(typingTime/1000)}с)`);
    await new Promise(resolve => setTimeout(resolve, typingTime));
    
    const finalDelay = this.random(this.delays.afterTyping.min, this.delays.afterTyping.max);
    console.log(`  📖 Проверка (${Math.round(finalDelay/1000)}с)`);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
    
    console.log('  📤 Отправка');
    const sentMessage = await callbacks.sendMessage();
    
    return sentMessage;
  }
}

module.exports = HumanBehaviorSimulator;