import { pgTable, text, integer, real, boolean, timestamp, serial } from "drizzle-orm/pg-core";

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

// Metrics Table
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

// Market Events Table
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
