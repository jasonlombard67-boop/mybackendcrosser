# Cross-Device Auth — Production Build

Magic-link cross-device session transfer. Educational implementation.

## Architecture

```
Browser (Device A) ──POST /api/login──► Express Server ──► Telegram
                                              │
                                         Token Store
                                         (in-memory)
                                              │
Browser (Device B) ──POST /api/redeem──► Express Server
                         ▲
                 /continue?token=<uuid>
```

---

## Quick Start (Development)

### 1. Configure the server
```bash
cd server
cp .env.example .env
# Edit .env — set TELEGRAM_CHAT_ID, APP_URL, CLIENT_ORIGIN
```

### 2. Run the server
```bash
cd server
npm install
npm run dev       # nodemon auto-reload
# or: npm start
```

### 3. Run the client (separate terminal)
```bash
cd client
npm install
npm start         # http://localhost:3000
```

---

## Production Deployment

### Option A — Docker (recommended)

```bash
# 1. Configure environment
cp server/.env.example server/.env
#    Fill in: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, APP_URL, CLIENT_ORIGIN

# 2. Build and start
docker-compose up -d --build

# 3. Check logs
docker-compose logs -f

# 4. Health check
curl http://localhost:4000/api/health
```

The Docker build:
- Builds the React app in a Node 20 Alpine stage
- Copies the `build/` output into the server image
- Express serves the static files + all API routes from port 4000
- Runs as a non-root user

### Option B — Manual VPS Deploy

```bash
# On your server:
git clone <your-repo> crossdevice-auth
cd crossdevice-auth

# Build React
cd client
npm ci
npm run build
cd ..

# Start server (Express serves the React build)
cd server
cp .env.example .env   # fill in values
npm ci --only=production
NODE_ENV=production node index.js

# Keep alive with PM2
npm install -g pm2
pm2 start index.js --name crossdevice-auth
pm2 save
pm2 startup
```

### Option C — Railway / Render / Fly.io

Set these environment variables in your platform dashboard:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` (or leave for auto) |
| `APP_URL` | `https://yourapp.railway.app` |
| `CLIENT_ORIGIN` | `https://yourapp.railway.app` |
| `TELEGRAM_BOT_TOKEN` | your bot token |
| `TELEGRAM_CHAT_ID` | your chat ID |
| `MAGIC_LINK_TTL_MS` | `300000` |
| `SESSION_TTL_MS` | `1800000` |

Build command: `cd client && npm ci && npm run build`  
Start command: `cd server && npm ci --only=production && node index.js`

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | None | Capture credentials, generate magic link |
| `GET`  | `/api/token-status?token=` | None | Peek token validity (no consume) |
| `POST` | `/api/redeem` | None | Consume token, set session cookie |
| `GET`  | `/api/health` | None | Uptime check |

### Rate Limits (configurable in .env)
- `/api/login` — 10 requests / 15 min / IP
- `/api/redeem` — 20 requests / 15 min / IP

---

## Security Properties

| Property | Implementation |
|----------|----------------|
| One-time use | `used=true` set atomically before returning — no double-redeem |
| 5-minute TTL | Configurable via `MAGIC_LINK_TTL_MS` |
| Rate limiting | `express-rate-limit` on login + redeem routes |
| Security headers | `helmet` — CSP, HSTS, X-Frame-Options, etc. |
| Session cookie | `HttpOnly`, `Secure` (prod), `SameSite=strict` |
| Body size limit | 16 KB max — prevents large payload attacks |
| Input validation | Type + format checked on every route |
| Graceful shutdown | SIGTERM / SIGINT handled — no mid-request kills |
| Non-root Docker | Runs as `appuser`, not root |
| Structured logging | Winston — JSON in prod, coloured in dev |

---

## Project Structure

```
crossdevice-prod/
├── Dockerfile                ← Multi-stage build
├── docker-compose.yml        ← One-command deploy
├── nginx.conf                ← HTTPS + reverse proxy config
├── .gitignore
│
├── server/
│   ├── index.js              ← Express app (helmet, rate-limit, static serve)
│   ├── config.js             ← Env validation — fails fast on missing vars
│   ├── tokenStore.js         ← In-memory store (swap for Redis in prod)
│   ├── telegram.js           ← Notifications with retry
│   ├── logger.js             ← Winston (JSON prod / coloured dev)
│   ├── .env.example          ← Template — copy to .env
│   └── package.json
│
└── client/
    ├── src/
    │   ├── api.js            ← Centralised fetch client
    │   ├── App.js
    │   ├── index.js / index.css
    │   ├── components/
    │   │   ├── CountdownTimer.jsx
    │   │   └── StepTracker.jsx
    │   └── pages/
    │       ├── LoginPage.jsx   ← Device A
    │       └── ContinuePage.jsx ← Device B (/continue?token=)
    ├── public/index.html
    ├── .env.example
    └── package.json
```

---

## Production Upgrade: Redis Token Store

To scale beyond a single server instance, replace the in-memory Map with Redis:

```js
// server/tokenStore.js  (Redis version sketch)
const redis = require("redis");
const client = redis.createClient({ url: process.env.REDIS_URL });

async function saveToken(token, payload, ttlMs) {
  await client.set(token, JSON.stringify({ ...payload, used: false }),
    { PX: ttlMs }  // PX = milliseconds TTL
  );
}

async function consumeToken(token) {
  // Lua script for atomic check-and-mark — prevents race conditions
  const script = `
    local v = redis.call('GET', KEYS[1])
    if not v then return nil end
    local r = cjson.decode(v)
    if r.used then return nil end
    r.used = true
    redis.call('SET', KEYS[1], cjson.encode(r), 'KEEPTTL')
    return cjson.encode(r)
  `;
  const result = await client.eval(script, { keys: [token], arguments: [] });
  return result ? JSON.parse(result) : null;
}
```
