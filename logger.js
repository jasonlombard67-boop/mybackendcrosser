// server/logger.js
const { createLogger, format, transports } = require("winston");

const isProd = process.env.NODE_ENV === "production";

const logger = createLogger({
  level: isProd ? "info" : "debug",
  format: isProd
    ? format.combine(format.timestamp(), format.json())
    : format.combine(
        format.colorize(),
        format.timestamp({ format: "HH:mm:ss" }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      ),
  transports: [
    new transports.Console(),
    // Uncomment to also write to files in production:
    // new transports.File({ filename: "logs/error.log", level: "error" }),
    // new transports.File({ filename: "logs/combined.log" }),
  ],
});

module.exports = logger;
