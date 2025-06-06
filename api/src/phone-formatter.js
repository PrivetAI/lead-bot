// // Универсальный форматтер номеров для всех стран
// class PhoneFormatter {
  
//   // Коды стран и их форматы
//   static COUNTRY_CODES = {
//     // Основные страны
//     '1': { name: 'US/Canada', length: 11, format: 'XXXXXXXXXXX' },
//     '7': { name: 'Russia/Kazakhstan', length: 11, format: 'XXXXXXXXXXX' },
//     '33': { name: 'France', length: 12, format: 'XXXXXXXXXXXX' },
//     '34': { name: 'Spain', length: 11, format: 'XXXXXXXXXXX' },
//     '39': { name: 'Italy', length: 12, format: 'XXXXXXXXXXXX' },
//     '44': { name: 'UK', length: 12, format: 'XXXXXXXXXXXX' },
//     '49': { name: 'Germany', length: 12, format: 'XXXXXXXXXXXX' },
//     '55': { name: 'Brazil', length: 13, format: 'XXXXXXXXXXXXX' },
//     '66': { name: 'Thailand', length: 11, format: 'XXXXXXXXXXX' },
//     '81': { name: 'Japan', length: 12, format: 'XXXXXXXXXXXX' },
//     '86': { name: 'China', length: 13, format: 'XXXXXXXXXXXXX' },
//     '91': { name: 'India', length: 12, format: 'XXXXXXXXXXXX' },
    
//     // Испаноговорящие страны Латинской Америки
//     '52': { name: 'Mexico 🇲🇽', length: 12, format: 'XXXXXXXXXXXX', localFormat: '044XXXXXXXX' },
//     '54': { name: 'Argentina 🇦🇷', length: 12, format: 'XXXXXXXXXXXX', localFormat: '011XXXXXXXX' },
//     '56': { name: 'Chile 🇨🇱', length: 11, format: 'XXXXXXXXXXX', localFormat: '9XXXXXXXX' },
//     '57': { name: 'Colombia 🇨🇴', length: 12, format: 'XXXXXXXXXXXX', localFormat: '3XXXXXXXXX' },
//     '58': { name: 'Venezuela 🇻🇪', length: 12, format: 'XXXXXXXXXXXX', localFormat: '04XXXXXXXX' },
//     '51': { name: 'Peru 🇵🇪', length: 11, format: 'XXXXXXXXXXX', localFormat: '9XXXXXXXX' },
//     '593': { name: 'Ecuador 🇪🇨', length: 12, format: 'XXXXXXXXXXXX', localFormat: '09XXXXXXXX' },
//     '591': { name: 'Bolivia 🇧🇴', length: 11, format: 'XXXXXXXXXXX', localFormat: '7XXXXXXXX' },
//     '595': { name: 'Paraguay 🇵🇾', length: 12, format: 'XXXXXXXXXXXX', localFormat: '09XXXXXXXX' },
//     '598': { name: 'Uruguay 🇺🇾', length: 11, format: 'XXXXXXXXXXX', localFormat: '09XXXXXXXX' },
    
//     // Центральная Америка и Карибы (испаноговорящие)
//     '502': { name: 'Guatemala 🇬🇹', length: 11, format: 'XXXXXXXXXXX', localFormat: '5XXXXXXXX' },
//     '503': { name: 'El Salvador 🇸🇻', length: 11, format: 'XXXXXXXXXXX', localFormat: '7XXXXXXX' },
//     '504': { name: 'Honduras 🇭🇳', length: 11, format: 'XXXXXXXXXXX', localFormat: '9XXXXXXX' },
//     '505': { name: 'Nicaragua 🇳🇮', length: 11, format: 'XXXXXXXXXXX', localFormat: '8XXXXXXX' },
//     '506': { name: 'Costa Rica 🇨🇷', length: 11, format: 'XXXXXXXXXXX', localFormat: '8XXXXXXX' },
//     '507': { name: 'Panama 🇵🇦', length: 11, format: 'XXXXXXXXXXX', localFormat: '6XXXXXXX' },
//     '53': { name: 'Cuba 🇨🇺', length: 10, format: 'XXXXXXXXXX', localFormat: '5XXXXXXX' },
//     '1809': { name: 'Dominican Republic 🇩🇴', length: 13, format: 'XXXXXXXXXXXXX', localFormat: '809XXXXXXX' },
//     '1829': { name: 'Dominican Republic 🇩🇴', length: 13, format: 'XXXXXXXXXXXXX', localFormat: '829XXXXXXX' },
//     '1849': { name: 'Dominican Republic 🇩🇴', length: 13, format: 'XXXXXXXXXXXXX', localFormat: '849XXXXXXX' },
    
//     // Испания
//     '34': { name: 'Spain 🇪🇸', length: 11, format: 'XXXXXXXXXXX', localFormat: '6XXXXXXXX' },
    
//     // Экваториальная Гвинея (испаноговорящая)
//     '240': { name: 'Equatorial Guinea 🇬🇶', length: 12, format: 'XXXXXXXXXXXX', localFormat: '222XXXXXX' },
    
//     // Остальные страны
//     '380': { name: 'Ukraine', length: 12, format: 'XXXXXXXXXXXX' },
//     '375': { name: 'Belarus', length: 12, format: 'XXXXXXXXXXXX' },
//     '371': { name: 'Latvia', length: 11, format: 'XXXXXXXXXXX' },
//     '372': { name: 'Estonia', length: 11, format: 'XXXXXXXXXXX' },
//     '373': { name: 'Moldova', length: 11, format: 'XXXXXXXXXXX' },
//     '374': { name: 'Armenia', length: 11, format: 'XXXXXXXXXXX' },
//     '994': { name: 'Azerbaijan', length: 12, format: 'XXXXXXXXXXXX' },
//     '995': { name: 'Georgia', length: 12, format: 'XXXXXXXXXXXX' },
//     '996': { name: 'Kyrgyzstan', length: 12, format: 'XXXXXXXXXXXX' },
//     '998': { name: 'Uzbekistan', length: 12, format: 'XXXXXXXXXXXX' }
//   };

//   /**
//    * Определяет код страны из номера
//    */
//   static detectCountryCode(phone) {
//     // Проверяем коды от длинных к коротким
//     const codes = Object.keys(this.COUNTRY_CODES).sort((a, b) => b.length - a.length);
    
//     for (const code of codes) {
//       if (phone.startsWith(code)) {
//         return code;
//       }
//     }
    
//     return null;
//   }

//   /**
//    * Универсальный форматтер номера
//    */
//   static formatToWID(phoneNumber) {
//     console.log('🔄 Formatting phone:', phoneNumber);
    
//     if (!phoneNumber) {
//       throw new Error('Phone number is required');
//     }

//     // Если уже в формате WID, возвращаем как есть
//     if (String(phoneNumber).includes('@c.us')) {
//       return String(phoneNumber);
//     }

//     // Убираем все кроме цифр
//     let phone = String(phoneNumber).replace(/\D/g, '');
//     console.log('📱 Digits only:', phone);

//     // Убираем ведущие нули
//     phone = phone.replace(/^0+/, '');
//     console.log('🔢 No leading zeros:', phone);

//     // Если номер пустой после очистки
//     if (!phone) {
//       throw new Error('Invalid phone number: no digits found');
//     }

//     // Пытаемся определить код страны
//     const countryCode = this.detectCountryCode(phone);
    
//     if (countryCode) {
//       const country = this.COUNTRY_CODES[countryCode];
//       console.log(`🌍 Detected country: ${country.name} (+${countryCode})`);
//       console.log(`📏 Expected length: ${country.length}, actual: ${phone.length}`);
      
//       // Проверяем длину номера
//       if (phone.length === country.length) {
//         console.log('✅ Length matches, using as is');
//       } else if (phone.length === country.length - countryCode.length) {
//         // Номер без кода страны, добавляем код
//         phone = countryCode + phone;
//         console.log(`🔧 Added country code: ${phone}`);
//       } else {
//         console.log(`⚠️ Length mismatch: expected ${country.length}, got ${phone.length}`);
//       }
//     } else {
//       console.log('❓ Country code not detected');
      
//       // Пытаемся угадать по длине
//       if (phone.length === 10) {
//         // Возможно US номер без кода страны
//         phone = '1' + phone;
//         console.log('🇺🇸 Assuming US number, added +1:', phone);
//       } else if (phone.length === 11 && phone.startsWith('8')) {
//         // Возможно российский номер в формате 8XXXXXXXXXX
//         phone = '7' + phone.substring(1);
//         console.log('🇷🇺 Converted 8XXX to 7XXX format:', phone);
//       }
//     }

//     // Финальная проверка длины
//     if (phone.length < 10 || phone.length > 15) {
//       throw new Error(`Invalid phone length: ${phone.length} digits (need 10-15)`);
//     }

//     const wid = phone + '@c.us';
//     console.log('✨ Final WID:', wid);
    
//     return wid;
//   }

//   /**
//    * Проверка валидности WID
//    */
//   static isValidWID(wid) {
//     const pattern = /^\d{10,15}@c\.us$/;
//     return pattern.test(wid);
//   }

//   /**
//    * Получение альтернативных форматов для номера
//    */
//   static getAlternativeFormats(phoneNumber) {
//     const phone = String(phoneNumber).replace(/\D/g, '').replace(/^0+/, '');
//     const alternatives = [];
    
//     // Оригинальный формат
//     alternatives.push(phone + '@c.us');
    
//     // Для российских номеров
//     if (phone.startsWith('7') && phone.length === 11) {
//       alternatives.push('8' + phone.substring(1) + '@c.us');
//     }
//     if (phone.startsWith('8') && phone.length === 11) {
//       alternatives.push('7' + phone.substring(1) + '@c.us');
//     }
    
//     // Определяем код страны
//     const countryCode = this.detectCountryCode(phone);
    
//     if (countryCode) {
//       const country = this.COUNTRY_CODES[countryCode];
//       const localNumber = phone.substring(countryCode.length);
      
//       // Общие альтернативы
//       if (localNumber.length > 0) {
//         alternatives.push(localNumber + '@c.us');
//         alternatives.push('0' + localNumber + '@c.us');
//       }
      
//       // Специфичные форматы для испаноговорящих стран
//       if (country.localFormat) {
//         console.log(`🌍 Trying local format for ${country.name}: ${country.localFormat}`);
//       }
      
//       switch (countryCode) {
//         case '52': // Мексика
//           if (localNumber.length === 10) {
//             // Мексика: +52 1 XXX XXX XXXX (мобильные)
//             alternatives.push('521' + localNumber + '@c.us');
//             // Местный формат: 044 + номер для звонков внутри страны
//             alternatives.push('044' + localNumber + '@c.us');
//           }
//           break;
          
//         case '54': // Аргентина
//           if (localNumber.length >= 8) {
//             // Аргентина: +54 9 11 XXXX XXXX (мобильные Buenos Aires)
//             if (localNumber.startsWith('9')) {
//               alternatives.push('54' + localNumber.substring(1) + '@c.us');
//             } else {
//               alternatives.push('549' + localNumber + '@c.us');
//             }
//             alternatives.push('011' + localNumber + '@c.us');
//           }
//           break;
          
//         case '57': // Колумбия
//           if (localNumber.length === 10) {
//             // Колумбия: мобильные начинаются с 3
//             if (!localNumber.startsWith('3')) {
//               alternatives.push('573' + localNumber.substring(1) + '@c.us');
//             }
//           }
//           break;
          
//         case '56': // Чили
//           if (localNumber.length >= 8) {
//             // Чили: мобильные начинаются с 9
//             if (!localNumber.startsWith('9')) {
//               alternatives.push('569' + localNumber + '@c.us');
//             }
//           }
//           break;
          
//         case '51': // Перу
//           if (localNumber.length >= 8) {
//             // Перу: мобильные начинаются с 9
//             if (!localNumber.startsWith('9')) {
//               alternatives.push('519' + localNumber + '@c.us');
//             }
//           }
//           break;
          
//         case '58': // Венесуэла
//           if (localNumber.length >= 9) {
//             // Венесуэла: мобильные 04XX
//             if (!localNumber.startsWith('04')) {
//               alternatives.push('5804' + localNumber.substring(2) + '@c.us');
//             }
//           }
//           break;
          
//         case '593': // Эквадор
//           if (localNumber.length >= 8) {
//             // Эквадор: мобильные 09X
//             if (!localNumber.startsWith('9')) {
//               alternatives.push('5939' + localNumber + '@c.us');
//             }
//           }
//           break;
          
//         case '1809': // Доминиканская Республика
//         case '1829':
//         case '1849':
//           // Альтернативные коды DR
//           const drCodes = ['1809', '1829', '1849'];
//           drCodes.forEach(code => {
//             if (code !== countryCode) {
//               alternatives.push(code + localNumber + '@c.us');
//             }
//           });
//           break;
          
//         case '34': // Испания
//           if (localNumber.length >= 8) {
//             // Испания: мобильные начинаются с 6, 7, 9
//             if (!['6', '7', '9'].includes(localNumber[0])) {
//               alternatives.push('346' + localNumber + '@c.us');
//               alternatives.push('347' + localNumber + '@c.us');
//             }
//           }
//           break;
//       }
//     }
    
//     // Убираем дубликаты и невалидные форматы
//     return [...new Set(alternatives)].filter(alt => {
//       const numberPart = alt.replace('@c.us', '');
//       return numberPart.length >= 10 && numberPart.length <= 15;
//     });
//   }
// }

// // Интеграция в WhatsApp сервис
// async function sendMessageWithRetry(phoneNumber, message, leadId = null) {
//   if (!this.isReady) {
//     throw new Error('WhatsApp client not ready');
//   }

//   try {
//     // Получаем основной формат
//     const wid = PhoneFormatter.formatToWID(phoneNumber);
//     console.log(`📞 Trying primary format: ${wid}`);
    
//     // Проверяем регистрацию
//     let isRegistered = await this.client.isRegisteredUser(wid);
//     let workingWid = wid;
    
//     // Если не зарегистрирован, пробуем альтернативные форматы
//     if (!isRegistered) {
//       console.log('❌ Primary format not registered, trying alternatives...');
//       const alternatives = PhoneFormatter.getAlternativeFormats(phoneNumber);
      
//       for (const altWid of alternatives) {
//         if (altWid === wid) continue; // Пропускаем уже проверенный
        
//         console.log(`🔄 Trying alternative: ${altWid}`);
//         isRegistered = await this.client.isRegisteredUser(altWid);
        
//         if (isRegistered) {
//           console.log(`✅ Found working format: ${altWid}`);
//           workingWid = altWid;
//           break;
//         }
//       }
//     }
    
//     if (!isRegistered) {
//       throw new Error(`Number ${phoneNumber} is not registered on WhatsApp. Tried formats: ${[wid, ...PhoneFormatter.getAlternativeFormats(phoneNumber)].join(', ')}`);
//     }
    
//     // Отправляем сообщение
//     console.log(`📤 Sending message to: ${workingWid}`);
//     const chat = await this.client.getChatById(workingWid);
//     const result = await chat.sendMessage(String(message));
    
//     console.log('✅ Message sent successfully');
//     return result;
    
//   } catch (error) {
//     console.error('❌ Send error:', error.message);
//     throw error;
//   }
// }

// // Экспорт для использования
// module.exports = {
//   PhoneFormatter,
//   sendMessageWithRetry
// };