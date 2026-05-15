require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

// Check required env variables
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const port = process.env.PORT || 3000;

console.log('🚀 Starting Telegram Bot...');
console.log(`📡 Mode: ${process.env.WEBHOOK_URL ? 'Webhook' : 'Polling'}`);
console.log(`🔗 Backend URL: ${process.env.BACKEND_URL || 'https://bloknotservis.ru'}`);

// Health check endpoint
bot.command('health', (ctx) => {
  ctx.reply('✅ Bot is healthy');
});

// Handle /start command with booking token
bot.start(async (ctx) => {
  const bookingToken = ctx.startPayload;
  const chatId = ctx.chat.id;
  const username = ctx.from?.username;

  if (!bookingToken) {
    await ctx.reply('Бот подключен ✅\n\nДля получения уведомлений о записях, используйте ссылку из формы записи.');
    return;
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'https://bloknotservis.ru';
    
    // Link telegram chatId to booking
    const response = await axios.post(`${backendUrl}/api/telegram/link-booking`, {
      bookingToken,
      chatId,
      username
    });

    const booking = response.data.booking;
    
    console.log(`[TELEGRAM LINKED] Booking ID: ${booking.id}, Chat ID: ${chatId}`);
    console.log(`[TELEGRAM] Booking data:`, JSON.stringify(booking, null, 2));

    // Send booking confirmation message with inline buttons
    const dateStr = new Date(booking.startsAt).toLocaleDateString('ru-RU');
    const timeStr = new Date(booking.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const confirmationMessage = `
✅ Запись подтверждена

📋 Услуга: ${booking.service?.name || 'Не указано'}
👨‍💼 Специалист: ${booking.master?.name || 'Не указано'}
📅 Дата: ${dateStr}
🕐 Время: ${timeStr}
🏢 ${booking.business?.name || ''}

Ждем вас!
    `.trim();

    // Create inline keyboard using Markup
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📅 Перенести запись', `reschedule_${booking.id}`),
        Markup.button.callback('❌ Отменить запись', `cancel_${booking.id}`)
      ]
    ]);

    await ctx.reply(confirmationMessage, keyboard);
    console.log(`[CONFIRMATION SENT] Booking ID: ${booking.id}, Chat ID: ${chatId}`);

  } catch (error) {
    console.error('Error linking booking:', error.response?.data || error.message);
    await ctx.reply('Ошибка подключения. Неверный токен бронирования.');
  }
});

// Handle callback queries (inline button presses)
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const chatId = ctx.chat.id;
  const [action, bookingId] = callbackData.split('_');

  console.log(`[CALLBACK] Action: ${action}, Booking ID: ${bookingId}, Chat ID: ${chatId}`);

  try {
    const backendUrl = process.env.BACKEND_URL || 'https://bloknotservis.ru';

    if (action === 'cancel') {
      // Cancel booking
      const response = await axios.post(`${backendUrl}/api/telegram/cancel-booking`, {
        bookingId: parseInt(bookingId),
        chatId
      });

      if (response.data.success) {
        await ctx.editMessageText('❌ Запись отменена');
        await ctx.answerCbQuery();
        console.log(`[BOOKING CANCELLED] Booking ID: ${bookingId}, Chat ID: ${chatId}`);
      } else {
        await ctx.answerCbQuery('Ошибка отмены записи');
      }
    } else if (action === 'reschedule') {
      // Generate reschedule link
      const response = await axios.post(`${backendUrl}/api/telegram/reschedule-link`, {
        bookingId: parseInt(bookingId),
        chatId
      });

      const rescheduleUrl = response.data.rescheduleUrl;
      
      await ctx.editMessageText('📅 Для переноса записи откройте ссылку:\n\n' + rescheduleUrl);
      await ctx.answerCbQuery();
      console.log(`[RESCHEDULE OPENED] Booking ID: ${bookingId}, Chat ID: ${chatId}`);
    } else {
      await ctx.answerCbQuery('Неизвестное действие');
    }
  } catch (error) {
    console.error('Error handling callback query:', error.response?.data || error.message);
    await ctx.answerCbQuery('Ошибка выполнения действия');
  }
});

// Handle other messages
bot.on('text', (ctx) => {
  ctx.reply('Для получения уведомлений о записях, используйте ссылку из формы записи.');
});

// Reminder system (runs every hour)
const sendReminders = async () => {
  try {
    const backendUrl = process.env.BACKEND_URL || 'https://bloknotservis.ru';
    const response = await axios.post(`${backendUrl}/api/telegram/send-reminders`);
    
    if (response.data.reminders) {
      for (const reminder of response.data.reminders) {
        try {
          await bot.telegram.sendMessage(reminder.chatId, reminder.message);
          console.log(`[REMINDER SENT] Booking ID: ${reminder.bookingId}, Type: ${reminder.type}, Chat ID: ${reminder.chatId}`);
        } catch (error) {
          console.error(`[REMINDER ERROR] Failed to send reminder to ${reminder.chatId}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error sending reminders:', error.response?.data || error.message);
  }
};

// Start reminder cron (every hour)
setInterval(sendReminders, 60 * 60 * 1000);
console.log('⏰ Reminder system started (every hour)');

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await bot.stop();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start bot
const startBot = async () => {
  try {
    const webhookUrl = process.env.WEBHOOK_URL;

    if (webhookUrl) {
      // Webhook mode
      console.log(`🔗 Setting webhook to: ${webhookUrl}`);
      await bot.telegram.setWebhook(webhookUrl);
      console.log('✅ Webhook configured');

      await bot.launch({
        webhook: {
          domain: new URL(webhookUrl).hostname,
          hookPath: '/webhook',
          port
        }
      });

      console.log(`🤖 Bot started in webhook mode on port ${port}`);
    } else {
      // Polling mode
      console.log('🔄 Starting in polling mode');
      await bot.launch();
      console.log('🤖 Bot started in polling mode');
    }
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
};

// Health check HTTP server for Railway
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`🚀 Health check server listening on port ${port}`);
  startBot();
});
