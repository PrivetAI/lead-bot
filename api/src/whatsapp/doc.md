API эндпоинты:

POST /telegram/userbot - отправка сообщений
GET /telegram/userbot/status - статус подключения

Структура данных для n8n:
json{
  "chat_id": "123456789",
  "message": "текст сообщения", 
  "lead_id": "lead_123",
  "tg_username": "username",
  "tg_user_id": "123456789",
  "direction": "incoming/outgoing"
}
Userbot автоматически запускается при старте API сервера и начинает обрабатывать входящие сообщения.RetryClaude does not have the ability to run the code it generates yet.Claude can make mistakes. Please double-check responses.