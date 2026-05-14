# Telegram Bot Service

Standalone Telegram bot service for Bloknot Booking. Deployed on Railway.

## Deployment on Railway

### 1. Create GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/telegram-bot.git
git push -u origin main
```

### 2. Connect to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `telegram-bot` repository
4. Railway will automatically detect it as a Node.js project

### 3. Add Environment Variables

In Railway project settings → Variables, add:

```
BOT_TOKEN=your_telegram_bot_token_from_botfather
BACKEND_URL=https://bloknotservis.ru
```

### 4. Get Webhook URL

After deployment, Railway will provide a URL like:
```
https://your-project-name.up.railway.app
```

Your webhook URL will be:
```
https://your-project-name.up.railway.app/webhook
```

Add this to Railway variables:
```
WEBHOOK_URL=https://your-project-name.up.railway.app/webhook
```

### 5. Set Webhook on Telegram

From your local machine (PowerShell):

```powershell
Invoke-WebRequest -Uri "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" -Method POST -Body @{ url = "https://your-project-name.up.railway.app/webhook" }
```

Replace `YOUR_BOT_TOKEN` with your actual bot token and the webhook URL with your Railway URL.

## Testing

1. Open your bot in Telegram: `https://t.me/your_bot_username`
2. Send `/start` - should reply: "Бот подключен ✅"
3. Test deep-link: `/start TOKEN` - should connect to backend

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `BACKEND_URL` | Yes | Backend API URL (https://bloknotservis.ru) |
| `WEBHOOK_URL` | Yes | Full webhook URL from Railway |
| `PORT` | No | Port for health check (default: 3000) |

## Health Check

The bot has a health check endpoint at `/health`. Railway will automatically use this to monitor the service.

## Architecture

- **Standalone service**: Runs independently from main backend
- **Webhook mode**: Uses Telegram webhook (not polling)
- **Backend integration**: Calls `/api/telegram/connect` on main backend
- **Deep-link support**: Handles `/start TOKEN` for user connection
