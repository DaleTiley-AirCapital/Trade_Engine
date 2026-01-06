import { pgTable, text, integer, real, boolean, timestamp, varchar, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Bot State Table
export const botStates = pgTable("bot_states", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("BOOTING"),
  lastHeartbeat: timestamp("last_heartbeat").defaultNow(),
  lastError: text("last_error"),
  errorTimestamp: timestamp("error_timestamp"),
  tradingMode: text("trading_mode").notNull().default("paper"),
  paperStartDate: timestamp("paper_start_date"),
  paperTradesCount: integer("paper_trades_count").notNull().default(0),
});

// Metrics Table (stores daily snapshots)
export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  date: timestamp("date").defaultNow(),
  equityUsdt: real("equity_usdt").notNull().default(0),
  equityZar: real("equity_zar").notNull().default(0),
  todayPnlUsdt: real("today_pnl_usdt").notNull().default(0),
  todayPnlPct: real("today_pnl_pct").notNull().default(0),
  todayMaxDrawdownPct: real("today_max_drawdown_pct").notNull().default(0),
  dailyLossRemaining: real("daily_loss_remaining").notNull().default(0),
  tradesRemaining: integer("trades_remaining").notNull().default(10),
  consecutiveLosses: integer("consecutive_losses").notNull().default(0),
  todayTradeCount: integer("today_trade_count").notNull().default(0),
  todayWinCount: integer("today_win_count").notNull().default(0),
  todayLossCount: integer("today_loss_count").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
});

// Trades Table
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  pnlUsdt: real("pnl_usdt"),
  pnlPct: real("pnl_pct"),
  duration: integer("duration"),
  fees: real("fees"),
  slippageEst: real("slippage_est"),
  exitReason: text("exit_reason"),
  entryTimestamp: timestamp("entry_timestamp").defaultNow(),
  exitTimestamp: timestamp("exit_timestamp"),
  setupId: text("setup_id"),
  isOpen: boolean("is_open").notNull().default(true),
});

// Market Events Table (liquidation signals)
export const marketEvents = pgTable("market_events", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  symbol: text("symbol").notNull(),
  liquidationUsd: real("liquidation_usd").notNull(),
  liquidationSide: text("liquidation_side").notNull(),
  volumeMult: real("volume_mult").notNull(),
  spreadBps: real("spread_bps").notNull(),
  priceDelta: real("price_delta").notNull().default(0),
  exhaustionCandles: integer("exhaustion_candles").notNull().default(0),
  liqSizeOk: boolean("liq_size_ok").notNull().default(false),
  volumeOk: boolean("volume_ok").notNull().default(false),
  spreadOk: boolean("spread_ok").notNull().default(false),
  momentumOk: boolean("momentum_ok").notNull().default(false),
  exhaustionOk: boolean("exhaustion_ok").notNull().default(false),
  passed: boolean("passed").notNull().default(false),
  rejectionReason: text("rejection_reason"),
});

// Log Entries Table
export const logEntries = pgTable("log_entries", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  level: text("level").notNull().default("INFO"),
  message: text("message").notNull(),
  details: text("details"),
});

// Config Table
export const configs = pgTable("configs", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().default(1),
  mode: text("mode").notNull().default("paper"),
  symbols: text("symbols").notNull().default("BTCUSDT,ETHUSDT"),
  leverage: integer("leverage").notNull().default(2),
  riskPerTradePct: real("risk_per_trade_pct").notNull().default(0.0025),
  dailyMaxLossPct: real("daily_max_loss_pct").notNull().default(0.015),
  maxTradesPerDay: integer("max_trades_per_day").notNull().default(10),
  maxConsecutiveLosses: integer("max_consecutive_losses").notNull().default(3),
  pauseAfterLossesMinutes: integer("pause_after_losses_minutes").notNull().default(60),
  maxMarginPerTradePct: real("max_margin_per_trade_pct").notNull().default(0.20),
  liqWindowSeconds: integer("liq_window_seconds").notNull().default(60),
  volumeLookback: integer("volume_lookback").notNull().default(20),
  volumeMult: real("volume_mult").notNull().default(2.0),
  exhaustionCandles: integer("exhaustion_candles").notNull().default(2),
  symbolCooldownSeconds: integer("symbol_cooldown_seconds").notNull().default(300),
  tpPct: real("tp_pct").notNull().default(0.0035),
  slPct: real("sl_pct").notNull().default(0.0045),
  timeStopSeconds: integer("time_stop_seconds").notNull().default(150),
  entryFillTimeoutMs: integer("entry_fill_timeout_ms").notNull().default(800),
  useMarketIfNotFilled: boolean("use_market_if_not_filled").notNull().default(true),
  enableSol: boolean("enable_sol").notNull().default(false),
  enableMomentumVariant: boolean("enable_momentum_variant").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Health Check Table
export const healthChecks = pgTable("health_checks", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("healthy"),
  apiConnected: boolean("api_connected").notNull().default(false),
  wsConnected: boolean("ws_connected").notNull().default(false),
  dbConnected: boolean("db_connected").notNull().default(false),
  lastCheck: timestamp("last_check").defaultNow(),
});

// Insert schemas
export const insertBotStateSchema = createInsertSchema(botStates).omit({ id: true });
export const insertMetricsSchema = createInsertSchema(metrics).omit({ id: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true });
export const insertMarketEventSchema = createInsertSchema(marketEvents).omit({ id: true });
export const insertLogEntrySchema = createInsertSchema(logEntries).omit({ id: true });
export const insertConfigSchema = createInsertSchema(configs).omit({ id: true });
export const insertHealthCheckSchema = createInsertSchema(healthChecks).omit({ id: true });

// Types
export type BotStateRecord = typeof botStates.$inferSelect;
export type InsertBotState = z.infer<typeof insertBotStateSchema>;

export type MetricsRecord = typeof metrics.$inferSelect;
export type InsertMetrics = z.infer<typeof insertMetricsSchema>;

export type TradeRecord = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type MarketEventRecord = typeof marketEvents.$inferSelect;
export type InsertMarketEvent = z.infer<typeof insertMarketEventSchema>;

export type LogEntryRecord = typeof logEntries.$inferSelect;
export type InsertLogEntry = z.infer<typeof insertLogEntrySchema>;

export type ConfigRecord = typeof configs.$inferSelect;
export type InsertConfig = z.infer<typeof insertConfigSchema>;

export type HealthCheckRecord = typeof healthChecks.$inferSelect;
export type InsertHealthCheck = z.infer<typeof insertHealthCheckSchema>;

// Zod Enums for validation
export const BotStateEnum = z.enum([
  "BOOTING",
  "RUNNING",
  "PAUSED_MANUAL",
  "PAUSED_RISK_LIMIT",
  "ERROR",
  "SHUTDOWN"
]);
export type BotStateType = z.infer<typeof BotStateEnum>;

export const TradingModeEnum = z.enum(["paper", "live"]);
export type TradingMode = z.infer<typeof TradingModeEnum>;

export const SymbolEnum = z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
export type Symbol = z.infer<typeof SymbolEnum>;

export const TradeSideEnum = z.enum(["LONG", "SHORT"]);
export type TradeSide = z.infer<typeof TradeSideEnum>;

export const ExitReasonEnum = z.enum(["TP", "SL", "TIME_STOP", "MANUAL", "FLATTEN"]);
export type ExitReason = z.infer<typeof ExitReasonEnum>;

export const LogLevelEnum = z.enum(["INFO", "WARN", "ERROR"]);
export type LogLevel = z.infer<typeof LogLevelEnum>;

// API Response Types (for frontend)
export interface BotState {
  id: number;
  status: string;
  lastHeartbeat: string;
  lastError: string | null;
  errorTimestamp: string | null;
  tradingMode: string;
  paperStartDate: string | null;
  paperTradesCount: number;
}

export interface Metrics {
  equityUsdt: number;
  equityZar: number;
  todayPnlUsdt: number;
  todayPnlPct: number;
  todayMaxDrawdownPct: number;
  dailyLossRemaining: number;
  tradesRemaining: number;
  consecutiveLosses: number;
  todayTradeCount: number;
  todayWinCount: number;
  todayLossCount: number;
  winRate: number;
}

export interface OpenPosition {
  id: number;
  symbol: string;
  side: string;
  entryPrice: number;
  quantity: number;
  unrealizedPnlUsdt: number;
  unrealizedPnlPct: number;
  entryTimestamp: string;
  timeInTrade: number;
}

export interface Trade {
  id: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  pnlUsdt: number | null;
  pnlPct: number | null;
  duration: number | null;
  fees: number | null;
  slippageEst: number | null;
  exitReason: string | null;
  entryTimestamp: string;
  exitTimestamp: string | null;
  setupId: string | null;
}

export interface MarketEvent {
  id: number;
  timestamp: string;
  symbol: string;
  liquidationUsd: number;
  liquidationSide: string;
  volumeMult: number;
  spreadBps: number;
  priceDelta: number;
  exhaustionCandles: number;
  liqSizeOk: boolean;
  volumeOk: boolean;
  spreadOk: boolean;
  momentumOk: boolean;
  exhaustionOk: boolean;
  passed: boolean;
  rejectionReason: string | null;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  message: string;
  details: string | null;
}

export interface Config {
  version: number;
  mode: string;
  symbols: string[];
  leverage: number;
  risk: {
    risk_per_trade_pct: number;
    daily_max_loss_pct: number;
    max_trades_per_day: number;
    max_consecutive_losses: number;
    pause_after_consecutive_losses_minutes: number;
    max_margin_per_trade_pct: number;
  };
  signal: {
    liq_window_seconds: number;
    min_liq_usd: Record<string, number>;
    volume_lookback: number;
    volume_mult: number;
    exhaustion_candles: number;
    max_spread_bps: Record<string, number>;
    symbol_cooldown_seconds: number;
  };
  execution: {
    tp_pct: number;
    sl_pct: number;
    time_stop_seconds: number;
    entry_fill_timeout_ms: number;
    use_market_if_not_filled: boolean;
  };
  feature_flags: {
    enable_sol: boolean;
    enable_momentum_variant: boolean;
  };
}

export interface HealthCheck {
  status: string;
  apiConnected: boolean;
  wsConnected: boolean;
  dbConnected: boolean;
  lastCheck: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: "ok" | "warning" | "error" | "pending";
  value: string | null;
}

// Control Actions
export const controlActionSchema = z.enum(["pause", "resume", "flatten"]);
export type ControlAction = z.infer<typeof controlActionSchema>;

// Legacy User types (keeping for compatibility)
export interface User {
  id: string;
  username: string;
  password: string;
}

export interface InsertUser {
  username: string;
  password: string;
}
