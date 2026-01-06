import { db } from "../db";
import { logEntries } from "../db/schema";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export async function log(level: LogLevel, message: string, details?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
  if (details) console.log(`  Details: ${details}`);
  
  try {
    await db.insert(logEntries).values({
      level,
      message,
      details: details || null,
    });
  } catch (err) {
    console.error("Failed to write log to database:", err);
  }
}

export const logger = {
  info: (message: string, details?: string) => log("INFO", message, details),
  warn: (message: string, details?: string) => log("WARN", message, details),
  error: (message: string, details?: string) => log("ERROR", message, details),
};
