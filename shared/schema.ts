import { z } from "zod";

// Bot States
export const BotStateEnum = z.enum([
  "BOOTING",
  "RUNNING",
  "PAUSED_MANUAL",
  "PAUSED_RISK_LIMIT",
  "ERROR",
  "SHUTDOWN"
]);
export type BotStateType = z.infer<typeof BotStateEnum>;

// Trading Mode
export const TradingModeEnum = z.enum(["paper", "live"]);
export type TradingMode = z.infer<typeof TradingModeEnum>;

// Symbol
export const SymbolEnum = z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
export type Symbol = z.infer<typeof SymbolEnum>;

// Trade Side
export const TradeSideEnum = z.enum(["LONG", "SHORT"]);
export type TradeSide = z.infer<typeof TradeSideEnum>;

// Exit Reason
export const ExitReasonEnum = z.enum(["TP", "SL", "TIME_STOP", "MANUAL", "FLATTEN"]);
export type ExitReason = z.infer<typeof ExitReasonEnum>;

// Log Level
export const LogLevelEnum = z.enum(["INFO", "WARN", "ERROR"]);
export type LogLevel = z.infer<typeof LogLevelEnum>;

// Bot State Schema
export const botStateSchema = z.object({
  id: z.string(),
  status: BotStateEnum,
  lastHeartbeat: z.string(),
  lastError: z.string().nullable(),
  errorTimestamp: z.string().nullable(),
  tradingMode: TradingModeEnum,
  paperStartDate: z.string().nullable(),
  paperTradesCount: z.number(),
});
export type BotState = z.infer<typeof botStateSchema>;

// Metrics Schema
export const metricsSchema = z.object({
  equityUsdt: z.number(),
  equityZar: z.number(),
  todayPnlUsdt: z.number(),
  todayPnlPct: z.number(),
  todayMaxDrawdownPct: z.number(),
  dailyLossRemaining: z.number(),
  tradesRemaining: z.number(),
  consecutiveLosses: z.number(),
  todayTradeCount: z.number(),
  todayWinCount: z.number(),
  todayLossCount: z.number(),
  winRate: z.number(),
});
export type Metrics = z.infer<typeof metricsSchema>;

// Open Position Schema
export const openPositionSchema = z.object({
  id: z.string(),
  symbol: SymbolEnum,
  side: TradeSideEnum,
  entryPrice: z.number(),
  quantity: z.number(),
  unrealizedPnlUsdt: z.number(),
  unrealizedPnlPct: z.number(),
  entryTimestamp: z.string(),
  timeInTrade: z.number(), // seconds
});
export type OpenPosition = z.infer<typeof openPositionSchema>;

// Trade Schema
export const tradeSchema = z.object({
  id: z.string(),
  symbol: SymbolEnum,
  side: TradeSideEnum,
  entryPrice: z.number(),
  exitPrice: z.number(),
  quantity: z.number(),
  pnlUsdt: z.number(),
  pnlPct: z.number(),
  duration: z.number(), // seconds
  fees: z.number(),
  slippageEst: z.number(),
  exitReason: ExitReasonEnum,
  entryTimestamp: z.string(),
  exitTimestamp: z.string(),
  setupId: z.string(),
});
export type Trade = z.infer<typeof tradeSchema>;

// Market Event Schema (liquidation signals)
export const marketEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  symbol: SymbolEnum,
  liquidationUsd: z.number(),
  liquidationSide: TradeSideEnum,
  volumeMult: z.number(),
  spreadBps: z.number(),
  passed: z.boolean(),
  rejectionReason: z.string().nullable(),
});
export type MarketEvent = z.infer<typeof marketEventSchema>;

// Log Entry Schema
export const logEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: LogLevelEnum,
  message: z.string(),
  details: z.string().nullable(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

// Risk Event Schema
export const riskEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventType: z.string(),
  description: z.string(),
  actionTaken: z.string(),
});
export type RiskEvent = z.infer<typeof riskEventSchema>;

// Config Schema
export const configSchema = z.object({
  version: z.number(),
  mode: TradingModeEnum,
  symbols: z.array(SymbolEnum),
  leverage: z.number().min(1).max(3),
  risk: z.object({
    risk_per_trade_pct: z.number().min(0.001).max(0.01),
    daily_max_loss_pct: z.number().min(0.005).max(0.05),
    max_trades_per_day: z.number().min(1).max(20),
    max_consecutive_losses: z.number().min(1).max(10),
    pause_after_consecutive_losses_minutes: z.number().min(15).max(180),
    max_margin_per_trade_pct: z.number().min(0.05).max(0.5),
  }),
  signal: z.object({
    liq_window_seconds: z.number().min(30).max(120),
    min_liq_usd: z.record(z.number()),
    volume_lookback: z.number().min(10).max(50),
    volume_mult: z.number().min(1.5).max(5),
    exhaustion_candles: z.number().min(1).max(5),
    max_spread_bps: z.record(z.number()),
    symbol_cooldown_seconds: z.number().min(60).max(600),
  }),
  execution: z.object({
    tp_pct: z.number().min(0.0025).max(0.0045),
    sl_pct: z.number().min(0.0035).max(0.0050),
    time_stop_seconds: z.number().min(120).max(180),
    entry_fill_timeout_ms: z.number().min(200).max(2000),
    use_market_if_not_filled: z.boolean(),
  }),
  feature_flags: z.object({
    enable_sol: z.boolean(),
    enable_momentum_variant: z.boolean(),
  }),
});
export type Config = z.infer<typeof configSchema>;

// Insert schemas for mutations
export const insertTradeSchema = tradeSchema.omit({ id: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export const insertMarketEventSchema = marketEventSchema.omit({ id: true });
export type InsertMarketEvent = z.infer<typeof insertMarketEventSchema>;

export const insertLogEntrySchema = logEntrySchema.omit({ id: true });
export type InsertLogEntry = z.infer<typeof insertLogEntrySchema>;

// Control Actions
export const controlActionSchema = z.enum(["pause", "resume", "flatten"]);
export type ControlAction = z.infer<typeof controlActionSchema>;

// Health Check Response
export const healthCheckSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  apiConnected: z.boolean(),
  wsConnected: z.boolean(),
  dbConnected: z.boolean(),
  lastCheck: z.string(),
});
export type HealthCheck = z.infer<typeof healthCheckSchema>;

// Daily Checklist Item
export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  status: z.enum(["ok", "warning", "error", "pending"]),
  value: z.string().nullable(),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

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
