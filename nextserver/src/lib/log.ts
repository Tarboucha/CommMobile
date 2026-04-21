import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Shared pino logger for nextserver.
 *
 * Usage:
 *   import { log } from "@/lib/log";
 *   log.info({ userId }, "user registered");
 *   log.error({ err }, "something failed");
 *
 * Use child loggers to add persistent context:
 *   const svcLog = log.child({ component: "storage-service" });
 */
export const log = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.token",
      "req.body.refresh_token",
    ],
    censor: "[REDACTED]",
  },
});
