import * as dotenv from "dotenv";
dotenv.config();

import { BinanceWebSocket } from "./services/binance-ws";
import { BinanceAPI } from "./services/binance-api";
import { LiquidationReversionStrategy } from "./strategies/liquidation-reversion";
import { logger } from "./services/logger";
import { db } from "./db";
import { configs, botStates } from "./db/schema";
import { desc } from "drizzle-orm";

async function main() {
  logger.info("Starting Liquidation Reversion Trading Bot");
  
  // Validate environment
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    logger.error("BINANCE_API_KEY and BINANCE_API_SECRET are required");
    process.exit(1);
  }
  
  // Get trading mode from database (set by dashboard toggle)
  let tradingMode = await getTradingModeFromDb();
  let isLive = tradingMode === "live";
  logger.info(`Trading mode: ${isLive ? "LIVE" : "PAPER"} (from database)`);
  
  // Load config from database or use defaults
  let config = await loadConfig();
  logger.info(`Config loaded: ${config.symbols.join(", ")}, Leverage: ${config.leverage}x`);
  
  // Initialize Binance connections
  const ws = new BinanceWebSocket(config.symbols);
  const api = new BinanceAPI(apiKey, apiSecret, !isLive);
  
  // Connect WebSocket
  try {
    await ws.connect();
    logger.info("Connected to Binance WebSocket");
  } catch (err) {
    logger.error("Failed to connect to Binance WebSocket", String(err));
    process.exit(1);
  }
  
  // Initialize strategy
  const strategy = new LiquidationReversionStrategy(ws, api, config, isLive);
  
  // Start the strategy
  await strategy.start();
  
  // Periodically check if trading mode changed in database
  setInterval(async () => {
    const newMode = await getTradingModeFromDb();
    if (newMode !== tradingMode) {
      logger.warn(`Trading mode changed from ${tradingMode.toUpperCase()} to ${newMode.toUpperCase()}`);
      tradingMode = newMode;
      isLive = tradingMode === "live";
      strategy.setLiveMode(isLive);
    }
  }, 5000); // Check every 5 seconds
  
  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down...");
    await strategy.flatten();
    await ws.disconnect();
    process.exit(0);
  });
  
  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down...");
    await strategy.flatten();
    await ws.disconnect();
    process.exit(0);
  });
  
  logger.info("Bot is running. Waiting for liquidation signals...");
}

async function getTradingModeFromDb(): Promise<"paper" | "live"> {
  try {
    const [state] = await db.select().from(botStates).orderBy(desc(botStates.id)).limit(1);
    if (state?.tradingMode === "live") {
      return "live";
    }
  } catch (err) {
    logger.warn("Could not read trading mode from database, defaulting to paper");
  }
  return "paper";
}

async function loadConfig() {
  try {
    const [record] = await db.select().from(configs).orderBy(desc(configs.id)).limit(1);
    
    if (record) {
      return {
        symbols: record.symbols.split(","),
        leverage: record.leverage,
        riskPerTradePct: record.riskPerTradePct,
        dailyMaxLossPct: record.dailyMaxLossPct,
        maxTradesPerDay: record.maxTradesPerDay,
        maxConsecutiveLosses: record.maxConsecutiveLosses,
        liqWindowSeconds: record.liqWindowSeconds,
        minLiqUsd: { BTCUSDT: 2500000, ETHUSDT: 1250000, SOLUSDT: 500000 },
        volumeMult: record.volumeMult,
        maxSpreadBps: { BTCUSDT: 3, ETHUSDT: 4, SOLUSDT: 5 },
        symbolCooldownSeconds: record.symbolCooldownSeconds,
        tpPct: record.tpPct,
        slPct: record.slPct,
        timeStopSeconds: record.timeStopSeconds,
        entryFillTimeoutMs: record.entryFillTimeoutMs,
      };
    }
  } catch (err) {
    logger.warn("Could not load config from database, using defaults");
  }
  
  // Default config
  return {
    symbols: ["BTCUSDT", "ETHUSDT"],
    leverage: 2,
    riskPerTradePct: 0.0025,
    dailyMaxLossPct: 0.015,
    maxTradesPerDay: 10,
    maxConsecutiveLosses: 3,
    liqWindowSeconds: 60,
    minLiqUsd: { BTCUSDT: 2500000, ETHUSDT: 1250000, SOLUSDT: 500000 },
    volumeMult: 2.0,
    maxSpreadBps: { BTCUSDT: 3, ETHUSDT: 4, SOLUSDT: 5 },
    symbolCooldownSeconds: 300,
    tpPct: 0.0035,
    slPct: 0.0045,
    timeStopSeconds: 150,
    entryFillTimeoutMs: 800,
  };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
