// server/config.js
// Validates all required env vars at startup so the server fails fast
// rather than crashing at runtime with a cryptic error.
require("dotenv").config();

const REQUIRED = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "APP_URL", "CLIENT_ORIGIN"];

const missing = REQUIRED.filter(k => !process.env[k] || process.env[k].includes("your_"));
if (missing.length) {
  console.error(`\n❌  Missing required environment variables:\n   ${missing.join(", ")}`);
  console.error(`   Copy server/.env.example → server/.env and fill in all values.\n`);
  process.exit(1);
}

module.exports = {
  NODE_ENV:   process.env.NODE_ENV   || "development",
  PORT:       parseInt(process.env.PORT) || 4000,
  APP_URL:    process.env.APP_URL.replace(/\/$/, ""),       // strip trailing slash
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN.replace(/\/$/, ""),
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CHAT_ID:   process.env.TELEGRAM_CHAT_ID,
  },
  TOKEN_TTL_MS:   parseInt(process.env.MAGIC_LINK_TTL_MS) || 5  * 60 * 1000,
  SESSION_TTL_MS: parseInt(process.env.SESSION_TTL_MS)    || 30 * 60 * 1000,
  RATE_LIMIT: {
    LOGIN_MAX:        parseInt(process.env.RATE_LIMIT_LOGIN_MAX)        || 10,
    LOGIN_WINDOW_MS:  parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS)  || 15 * 60 * 1000,
    REDEEM_MAX:       parseInt(process.env.RATE_LIMIT_REDEEM_MAX)       || 20,
    REDEEM_WINDOW_MS: parseInt(process.env.RATE_LIMIT_REDEEM_WINDOW_MS) || 15 * 60 * 1000,
  },
  IS_PROD: process.env.NODE_ENV === "production",
};
