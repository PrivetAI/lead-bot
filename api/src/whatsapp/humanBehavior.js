// api/src/whatsapp/humanBehavior.js

class HumanBehaviorSimulator {
  constructor() {
    // Настройки скорости чтения (слов в минуту)
    this.readingSpeed = {
      min: 180, // медленное чтение
      max: 300, // быстрое чтение
      average: 240
    };
    
    // Настройки скорости печати (символов в минуту)
    this.typingSpeed = {
      min: 180, // медленная печать (3 символа в секунду)
      max: 360, // быстрая печать (6 символов в секунду)
      average: 240 // средняя печать (4 символа в секунду)
    };
    
    // Задержки между действиями (мс)
    this.delays = {
      beforeReading: { min: 1000, max: 3000 }, // 1-3 сек до прочтения
      afterReading: { min: 2000, max: 5000 }, // 2-5 сек после прочтения до начала ответа
      beforeTyping: { min: 1500, max: 4000 }, // 1.5-4 сек до начала печати
      betweenTyping: { min: 800, max: 2000 }, // 0.8-2 сек пауза во время печати
      afterTyping: { min: 500, max: 1500 } // 0.5-1.5 сек перед отправкой
    };
    
    // Вероятности действий
    this.probabilities = {
      makingTypoPause: 0.2, // вероятность паузы при "опечатке" (20%)
      longPause: 0.15, // вероятность длинной паузы (15%)
      fastResponse: 0.1 // вероятность быстрого ответа (10%)
    };
  }
  
  // Генерация случайного числа в диапазоне
  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // Симуляция прочтения сообщения
  async simulateMessageReading(waId, sendSeenCallback) {
    // Реалистичная задержка перед просмотром (2-8 секунд)
    const viewDelay = this.random(2000, 8000);
    console.log(`⏱️ Задержка перед просмотром: ${viewDelay}мс (${waId})`);
    
    // Ждем
    await new Promise(resolve => setTimeout(resolve, viewDelay));
    
    console.log('🔄 Вызываем callback для отметки просмотра...');
    
    try {
      // Вызываем callback для отметки "просмотрено"
      await sendSeenCallback();
      console.log('✅ Callback выполнен успешно');
    } catch (error) {
      console.error('❌ Ошибка при выполнении callback:', error);
      throw error; // Пробрасываем ошибку дальше
    }
  }
  
  // Расчет времени чтения сообщения
  calculateReadingTime(text) {
    const words = text.trim().split(/\s+/).length;
    const wpm = this.random(this.readingSpeed.min, this.readingSpeed.max);
    const baseTime = (words / wpm) * 60000; // в миллисекундах
    
    // Добавляем случайность
    const variance = baseTime * 0.2; // ±20%
    const readingTime = baseTime + this.random(-variance, variance);
    
    // Минимум 1 секунда, максимум 10 секунд
    return Math.max(1000, Math.min(readingTime, 10000));
  }
  
  // Расчет времени печати сообщения
  calculateTypingTime(text) {
    const chars = text.length;
    const cpm = this.random(this.typingSpeed.min, this.typingSpeed.max);
    const baseTime = (chars / cpm) * 60000; // в миллисекундах
    
    // Добавляем паузы на "обдумывание" каждые 20-30 символов
    const thinkingPauses = Math.floor(chars / 25) * this.random(500, 1500);
    
    // Случайные паузы при "опечатках"
    let typoPauses = 0;
    if (Math.random() < this.probabilities.makingTypoPause) {
      typoPauses = this.random(2000, 4000); // 2-4 сек на исправление
    }
    
    const totalTime = baseTime + thinkingPauses + typoPauses;
    
    // Минимум 3 секунды, максимум 45 секунд
    return Math.max(3000, Math.min(totalTime, 45000));
  }
  
  // Симуляция отправки сообщения
  async simulateMessageSending(incomingMessage, outgoingMessage, callbacks) {
    const isQuickResponse = outgoingMessage.length < 50 && Math.random() < 0.3;
    const sequence = isQuickResponse 
      ? await this.generateQuickResponse(outgoingMessage)
      : await this.generateResponseSequence(incomingMessage, outgoingMessage);
    
    console.log('🎭 Начинаем имитацию человеческого поведения...');
    
    let sentMessage = null;
    
    for (const step of sequence) {
      console.log(`  ${step.description}`);
      
      switch (step.action) {
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.duration));
          break;
          
        case 'typing':
          await callbacks.sendTyping();
          break;
          
        case 'stopTyping':
          // WhatsApp автоматически останавливает индикатор печати
          break;
          
        case 'send':
          sentMessage = await callbacks.sendMessage();
          break;
      }
    }
    
    return sentMessage;
  }
  
  // Генерация последовательности действий для ответа
  async generateResponseSequence(incomingMessage, outgoingMessage) {
    const sequence = [];
    
    // 1. Время на обдумывание ответа (сообщение уже просмотрено в handleIncomingMessage)
    const thinkingTime = this.random(
      this.delays.afterReading.min,
      this.delays.afterReading.max
    );
    sequence.push({
      action: 'wait',
      duration: thinkingTime,
      description: `Обдумывание ответа (${Math.round(thinkingTime/1000)}с)`
    });
    
    // Иногда делаем длинную паузу (человек отвлекся)
    if (Math.random() < this.probabilities.longPause) {
      const longPause = this.random(10000, 30000); // 10-30 сек
      sequence.push({
        action: 'wait',
        duration: longPause,
        description: `Длинная пауза - отвлекся (${Math.round(longPause/1000)}с)`
      });
    }
    
    // 2. Начало печати
    sequence.push({
      action: 'typing',
      description: 'Начать печатать'
    });
    
    // 3. Время печати с возможными паузами
    const typingTime = this.calculateTypingTime(outgoingMessage);
    const typingSegments = this.splitTypingTime(typingTime);
    
    for (const segment of typingSegments) {
      sequence.push({
        action: 'wait',
        duration: segment.duration,
        description: segment.description
      });
      
      if (segment.pauseAfter) {
        sequence.push({
          action: 'stopTyping',
          description: 'Пауза в печати'
        });
        sequence.push({
          action: 'wait',
          duration: segment.pauseDuration,
          description: 'Думает'
        });
        sequence.push({
          action: 'typing',
          description: 'Продолжить печатать'
        });
      }
    }
    
    // 4. Финальная задержка перед отправкой
    const afterTypeDelay = this.random(
      this.delays.afterTyping.min,
      this.delays.afterTyping.max
    );
    sequence.push({
      action: 'wait',
      duration: afterTypeDelay,
      description: 'Перечитывание перед отправкой'
    });
    
    // 5. Отправка сообщения
    sequence.push({
      action: 'send',
      description: 'Отправить сообщение'
    });
    
    return sequence;
  }
  
  // Разбивка времени печати на сегменты с паузами
  splitTypingTime(totalTime) {
    const segments = [];
    let remainingTime = totalTime;
    
    // Количество пауз зависит от длины сообщения
    const pauseCount = Math.random() < 0.7 ? 0 : this.random(1, 2);
    
    if (pauseCount === 0) {
      segments.push({
        duration: totalTime,
        description: `Печатает (${Math.round(totalTime/1000)}с)`,
        pauseAfter: false
      });
    } else {
      const segmentCount = pauseCount + 1;
      const baseSegmentTime = totalTime / segmentCount;
      
      for (let i = 0; i < segmentCount; i++) {
        const variance = baseSegmentTime * 0.3;
        const segmentTime = baseSegmentTime + this.random(-variance, variance);
        
        segments.push({
          duration: Math.max(1000, segmentTime),
          description: `Печатает сегмент ${i+1}`,
          pauseAfter: i < segmentCount - 1,
          pauseDuration: i < segmentCount - 1 ? this.random(500, 2000) : 0
        });
        
        remainingTime -= segmentTime;
      }
    }
    
    return segments;
  }
  
  // Симуляция отправки приветственного сообщения
  async simulateWelcomeMessage(message, callbacks) {
    // Короткая задержка перед отправкой
    const initialDelay = this.random(1000, 2000);
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    // Начинаем печатать
    await callbacks.sendTyping();
    
    // Время печати приветствия (обычно короче)
    const typingTime = Math.min(
      this.calculateTypingTime(message),
      5000
    );
    await new Promise(resolve => setTimeout(resolve, typingTime));
    
    // Отправляем
    return await callbacks.sendMessage();
  }
  
  // Быстрый ответ (для простых сообщений)
  async generateQuickResponse(outgoingMessage) {
    return [
      {
        action: 'wait',
        duration: this.random(300, 800),
        description: 'Быстрая реакция'
      },
      {
        action: 'typing',
        description: 'Начать печатать'
      },
      {
        action: 'wait',
        duration: this.random(1000, 2000),
        description: 'Быстрая печать'
      },
      {
        action: 'send',
        description: 'Отправить сообщение'
      }
    ];
  }
}

module.exports = HumanBehaviorSimulator;