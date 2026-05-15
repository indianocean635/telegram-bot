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

// Handle /start command with deep-link payload
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  const chatId = ctx.chat.id;
  const username = ctx.from?.username;

  if (!payload) {
    await ctx.reply('Бот подключен ✅\n\nДля получения уведомлений о записях, используйте ссылку из формы записи.');
    return;
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'https://bloknotservis.ru';
    await axios.post(`${backendUrl}/api/telegram/connect`, {
      token: payload,
      chatId,
      username
    });

    await ctx.reply('Telegram успешно подключен ✅\n\nТеперь вы будете получать уведомления о записях.');
  } catch (error) {
    console.error('Error connecting Telegram:', error.response?.data || error.message);
    await ctx.reply('Ошибка подключения Telegram. Попробуйте позже.');
  }
});

// Handle other messages
bot.on('text', (ctx) => {
  ctx.reply('Для подключения уведомлений, используйте ссылку из формы записи.');
});

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
