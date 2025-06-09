// api/src/whatsapp/humanBehavior.js

class HumanBehaviorSimulator {
 constructor() {
   this.delays = {
     beforeTyping: { min: 2000, max: 5000 }, // 2-5 сек перед началом печати
     afterTyping: { min: 500, max: 1500 }, // 0.5-1.5 сек перед отправкой
     viewMessage: { min: 1000, max: 3000 }, // 1-3 сек перед просмотром
     typingPause: { min: 2000, max: 5000 } // 2-5 сек случайные паузы при печати
   };
   
   // Простые настройки скорости
   this.readingSpeed = 250; // символов в секунду при чтении
   this.typingSpeed = 4; // символов в секунду при печати
 }
 
 // Генерация случайного числа в диапазоне
 random(min, max) {
   return Math.floor(Math.random() * (max - min + 1)) + min;
 }
 
 // Простой расчет времени чтения по длине сообщения
 calculateReadingTime(text) {
   if (!text) return 0;
   
   const chars = text.length;
   // Базовое время: символы / скорость чтения (в мс)
   const baseTime = (chars / this.readingSpeed) * 1000;
   
   // Добавляем случайность ±30%
   const variance = baseTime * 0.3;
   const readingTime = baseTime + this.random(-variance, variance);
   
   // Минимум 300мс, максимум 5 секунд
   return Math.max(300, Math.min(readingTime, 5000));
 }
 
 // Простой расчет времени печати по длине сообщения
 calculateTypingTime(text) {
   const chars = text.length;
   // Базовое время: символы / скорость печати (в мс)
   const baseTime = (chars / this.typingSpeed) * 1000;
   
   // Добавляем случайность ±25%
   const variance = baseTime * 0.25;
   const typingTime = baseTime + this.random(-variance, variance);
   
   // Только минимум 1 секунда, без максимума
   return Math.max(1000, typingTime);
 }
 
 // Симуляция прочтения сообщения с учетом длины
 async simulateMessageReading(waId, sendSeenCallback, incomingMessage = '') {
   // Базовая задержка перед началом чтения
   const viewDelay = this.random(this.delays.viewMessage.min, this.delays.viewMessage.max);
   
   // Время на чтение самого сообщения
   const readingTime = this.calculateReadingTime(incomingMessage);
   
   const totalDelay = viewDelay + readingTime;
   
   console.log(`⏱️ Задержка: ${viewDelay}мс + чтение ${incomingMessage.length} символов: ${Math.round(readingTime)}мс = ${Math.round(totalDelay)}мс`);
   
   await new Promise(resolve => setTimeout(resolve, totalDelay));
   
   try {
     await sendSeenCallback();
     console.log('✅ Сообщение помечено как просмотренное');
   } catch (error) {
     console.error('❌ Ошибка при пометке как просмотренное:', error);
     throw error;
   }
 }
 
 // Симуляция отправки сообщения с учетом длины
 async simulateMessageSending(outgoingMessage, callbacks) {
   console.log('🎭 Начинаем имитацию человеческого поведения...');
   
   // 1. Пауза перед началом печати
   const thinkingTime = this.random(this.delays.beforeTyping.min, this.delays.beforeTyping.max);
   console.log(`  💭 Обдумывание ответа (${Math.round(thinkingTime/1000)}с)`);
   await new Promise(resolve => setTimeout(resolve, thinkingTime));
   
   // 2. Начинаем печать
   console.log('  ⌨️ Начинаем печатать');
   await callbacks.sendTyping();
   
   // 3. Время печати зависит от длины сообщения
   const typingTime = this.calculateTypingTime(outgoingMessage);
   console.log(`  ⌨️ Печатаем ${outgoingMessage.length} символов (${Math.round(typingTime/1000)}с)`);
   
   // Разбиваем время печати на части со случайными паузами
   const segments = Math.floor(typingTime / 15000); // Пауза примерно каждые 15 сек
   if (segments > 0) {
     const segmentTime = typingTime / (segments + 1);
     
     for (let i = 0; i <= segments; i++) {
       await new Promise(resolve => setTimeout(resolve, segmentTime));
       
       // Случайная пауза между сегментами (кроме последнего)
       if (i < segments) {
         const pauseTime = this.random(this.delays.typingPause.min, this.delays.typingPause.max);
         console.log(`  ⏸️ Пауза при печати (${Math.round(pauseTime/1000)}с)`);
         await new Promise(resolve => setTimeout(resolve, pauseTime));
         
         // Возобновляем индикатор печати после паузы
         await callbacks.sendTyping();
       }
     }
   } else {
     // Для коротких сообщений - без пауз
     await new Promise(resolve => setTimeout(resolve, typingTime));
   }
   
   // 4. Финальная пауза перед отправкой
   const finalDelay = this.random(this.delays.afterTyping.min, this.delays.afterTyping.max);
   console.log(`  📖 Перечитывание (${Math.round(finalDelay/1000)}с)`);
   await new Promise(resolve => setTimeout(resolve, finalDelay));
   
   // 5. Отправляем сообщение
   console.log('  📤 Отправляем сообщение');
   const sentMessage = await callbacks.sendMessage();
   
   return sentMessage;
 }
}

module.exports = HumanBehaviorSimulator;