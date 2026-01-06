import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  botStates,
  metrics,
  trades,
  marketEvents,
  logEntries,
  configs,
  healthChecks,
  type BotState,
  type Metrics,
  type OpenPosition,
  type Trade,
  type MarketEvent,
  type LogEntry,
  type Config,
  type ChecklistItem,
  type HealthCheck,
  type InsertTrade,
  type InsertMarketEvent,
  type InsertLogEntry,
} from "@shared/schema";

export interface IStorage {
  getBotState(): Promise<BotState>;
  updateBotState(updates: Partial<BotState>): Promise<BotState>;
  getMetrics(): Promise<Metrics>;
  updateMetrics(updates: Partial<Metrics>): Promise<Metrics>;
  getOpenPosition(): Promise<OpenPosition | null>;
  setOpenPosition(position: OpenPosition | null): Promise<void>;
  getTrades(filters?: { symbol?: string; side?: string; exitReason?: string; page?: number; pageSize?: number }): Promise<{ trades: Trade[]; total: number }>;
  addTrade(trade: InsertTrade): Promise<Trade>;
  getEvents(filters?: { symbol?: string; passed?: boolean }): Promise<{ events: MarketEvent[]; total: number }>;
  addEvent(event: InsertMarketEvent): Promise<MarketEvent>;
  getLogs(filters?: { level?: string; limit?: number }): Promise<{ logs: LogEntry[]; total: number }>;
  addLog(log: InsertLogEntry): Promise<LogEntry>;
  getConfig(): Promise<Config>;
  updateConfig(config: Partial<Config>): Promise<Config>;
  getChecklist(): Promise<ChecklistItem[]>;
  getHealth(): Promise<HealthCheck>;
  updateHealth(health: Partial<HealthCheck>): Promise<HealthCheck>;
}

export class DatabaseStorage implements IStorage {
  async getBotState(): Promise<BotState> {
    const [state] = await db.select().from(botStates).orderBy(desc(botStates.id)).limit(1);
    
    if (!state) {
      const [newState] = await db.insert(botStates).values({
        status: "BOOTING",
        tradingMode: "paper",
        paperTradesCount: 0,
      }).returning();
      return this.formatBotState(newState);
    }
    
    return this.formatBotState(state);
  }

  private formatBotState(state: typeof botStates.$inferSelect): BotState {
    return {
      id: state.id,
      status: state.status,
      lastHeartbeat: state.lastHeartbeat?.toISOString() || new Date().toISOString(),
      lastError: state.lastError,
      errorTimestamp: state.errorTimestamp?.toISOString() || null,
      tradingMode: state.tradingMode,
      paperStartDate: state.paperStartDate?.toISOString() || null,
      paperTradesCount: state.paperTradesCount,
    };
  }

  async updateBotState(updates: Partial<BotState>): Promise<BotState> {
    const current = await this.getBotState();
    
    await db.update(botStates)
      .set({
        status: updates.status || current.status,
        lastHeartbeat: new Date(),
        lastError: updates.lastError !== undefined ? updates.lastError : current.lastError,
        tradingMode: updates.tradingMode || current.tradingMode,
        paperTradesCount: updates.paperTradesCount ?? current.paperTradesCount,
      })
      .where(eq(botStates.id, current.id));
    
    return this.getBotState();
  }

  async getMetrics(): Promise<Metrics> {
    const [record] = await db.select().from(metrics).orderBy(desc(metrics.id)).limit(1);
    
    if (!record) {
      return {
        equityUsdt: 0,
        equityZar: 0,
        todayPnlUsdt: 0,
        todayPnlPct: 0,
        todayMaxDrawdownPct: 0,
        dailyLossRemaining: 0,
        tradesRemaining: 10,
        consecutiveLosses: 0,
        todayTradeCount: 0,
        todayWinCount: 0,
        todayLossCount: 0,
        winRate: 0,
      };
    }
    
    return {
      equityUsdt: record.equityUsdt,
      equityZar: record.equityZar,
      todayPnlUsdt: record.todayPnlUsdt,
      todayPnlPct: record.todayPnlPct,
      todayMaxDrawdownPct: record.todayMaxDrawdownPct,
      dailyLossRemaining: record.dailyLossRemaining,
      tradesRemaining: record.tradesRemaining,
      consecutiveLosses: record.consecutiveLosses,
      todayTradeCount: record.todayTradeCount,
      todayWinCount: record.todayWinCount,
      todayLossCount: record.todayLossCount,
      winRate: record.winRate,
    };
  }

  async updateMetrics(updates: Partial<Metrics>): Promise<Metrics> {
    const [existing] = await db.select().from(metrics).orderBy(desc(metrics.id)).limit(1);
    
    if (existing) {
      await db.update(metrics).set({
        ...updates,
        date: new Date(),
      }).where(eq(metrics.id, existing.id));
    } else {
      await db.insert(metrics).values({
        equityUsdt: updates.equityUsdt ?? 0,
        equityZar: updates.equityZar ?? 0,
        todayPnlUsdt: updates.todayPnlUsdt ?? 0,
        todayPnlPct: updates.todayPnlPct ?? 0,
        todayMaxDrawdownPct: updates.todayMaxDrawdownPct ?? 0,
        dailyLossRemaining: updates.dailyLossRemaining ?? 0,
        tradesRemaining: updates.tradesRemaining ?? 10,
        consecutiveLosses: updates.consecutiveLosses ?? 0,
        todayTradeCount: updates.todayTradeCount ?? 0,
        todayWinCount: updates.todayWinCount ?? 0,
        todayLossCount: updates.todayLossCount ?? 0,
        winRate: updates.winRate ?? 0,
      });
    }
    
    return this.getMetrics();
  }

  async getOpenPosition(): Promise<OpenPosition | null> {
    const [openTrade] = await db.select()
      .from(trades)
      .where(eq(trades.isOpen, true))
      .orderBy(desc(trades.entryTimestamp))
      .limit(1);
    
    if (!openTrade) return null;
    
    const entryTime = openTrade.entryTimestamp ? new Date(openTrade.entryTimestamp).getTime() : Date.now();
    const timeInTrade = Math.floor((Date.now() - entryTime) / 1000);
    
    return {
      id: openTrade.id,
      symbol: openTrade.symbol,
      side: openTrade.side,
      entryPrice: openTrade.entryPrice,
      quantity: openTrade.quantity,
      unrealizedPnlUsdt: 0,
      unrealizedPnlPct: 0,
      entryTimestamp: openTrade.entryTimestamp?.toISOString() || new Date().toISOString(),
      timeInTrade,
    };
  }

  async setOpenPosition(position: OpenPosition | null): Promise<void> {
    if (!position) {
      await db.update(trades).set({ isOpen: false }).where(eq(trades.isOpen, true));
    }
  }

  async getTrades(filters?: { symbol?: string; side?: string; exitReason?: string; page?: number; pageSize?: number }): Promise<{ trades: Trade[]; total: number }> {
    const conditions = [eq(trades.isOpen, false)];
    
    if (filters?.symbol) {
      conditions.push(eq(trades.symbol, filters.symbol));
    }
    if (filters?.side) {
      conditions.push(eq(trades.side, filters.side));
    }
    if (filters?.exitReason) {
      conditions.push(eq(trades.exitReason, filters.exitReason));
    }
    
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(whereClause);
    
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    
    const results = await db.select()
      .from(trades)
      .where(whereClause)
      .orderBy(desc(trades.entryTimestamp))
      .limit(pageSize)
      .offset(offset);
    
    return {
      trades: results.map(t => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        quantity: t.quantity,
        pnlUsdt: t.pnlUsdt,
        pnlPct: t.pnlPct,
        duration: t.duration,
        fees: t.fees,
        slippageEst: t.slippageEst,
        exitReason: t.exitReason,
        entryTimestamp: t.entryTimestamp?.toISOString() || new Date().toISOString(),
        exitTimestamp: t.exitTimestamp?.toISOString() || null,
        setupId: t.setupId,
      })),
      total: Number(countResult?.count || 0),
    };
  }

  async addTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return {
      id: newTrade.id,
      symbol: newTrade.symbol,
      side: newTrade.side,
      entryPrice: newTrade.entryPrice,
      exitPrice: newTrade.exitPrice,
      quantity: newTrade.quantity,
      pnlUsdt: newTrade.pnlUsdt,
      pnlPct: newTrade.pnlPct,
      duration: newTrade.duration,
      fees: newTrade.fees,
      slippageEst: newTrade.slippageEst,
      exitReason: newTrade.exitReason,
      entryTimestamp: newTrade.entryTimestamp?.toISOString() || new Date().toISOString(),
      exitTimestamp: newTrade.exitTimestamp?.toISOString() || null,
      setupId: newTrade.setupId,
    };
  }

  async getEvents(filters?: { symbol?: string; passed?: boolean }): Promise<{ events: MarketEvent[]; total: number }> {
    const conditions: any[] = [];
    
    if (filters?.symbol) {
      conditions.push(eq(marketEvents.symbol, filters.symbol));
    }
    if (filters?.passed !== undefined) {
      conditions.push(eq(marketEvents.passed, filters.passed));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(marketEvents)
      .where(whereClause);
    
    const results = await db.select()
      .from(marketEvents)
      .where(whereClause)
      .orderBy(desc(marketEvents.timestamp))
      .limit(100);
    
    return {
      events: results.map(e => ({
        id: e.id,
        timestamp: e.timestamp?.toISOString() || new Date().toISOString(),
        symbol: e.symbol,
        liquidationUsd: e.liquidationUsd,
        liquidationSide: e.liquidationSide,
        volumeMult: e.volumeMult,
        spreadBps: e.spreadBps,
        passed: e.passed,
        rejectionReason: e.rejectionReason,
      })),
      total: Number(countResult?.count || 0),
    };
  }

  async addEvent(event: InsertMarketEvent): Promise<MarketEvent> {
    const [newEvent] = await db.insert(marketEvents).values(event).returning();
    return {
      id: newEvent.id,
      timestamp: newEvent.timestamp?.toISOString() || new Date().toISOString(),
      symbol: newEvent.symbol,
      liquidationUsd: newEvent.liquidationUsd,
      liquidationSide: newEvent.liquidationSide,
      volumeMult: newEvent.volumeMult,
      spreadBps: newEvent.spreadBps,
      passed: newEvent.passed,
      rejectionReason: newEvent.rejectionReason,
    };
  }

  async getLogs(filters?: { level?: string; limit?: number }): Promise<{ logs: LogEntry[]; total: number }> {
    const conditions: any[] = [];
    
    if (filters?.level) {
      conditions.push(eq(logEntries.level, filters.level));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(logEntries)
      .where(whereClause);
    
    const limit = filters?.limit || 100;
    
    const results = await db.select()
      .from(logEntries)
      .where(whereClause)
      .orderBy(desc(logEntries.timestamp))
      .limit(limit);
    
    return {
      logs: results.map(l => ({
        id: l.id,
        timestamp: l.timestamp?.toISOString() || new Date().toISOString(),
        level: l.level,
        message: l.message,
        details: l.details,
      })),
      total: Number(countResult?.count || 0),
    };
  }

  async addLog(log: InsertLogEntry): Promise<LogEntry> {
    const [newLog] = await db.insert(logEntries).values(log).returning();
    return {
      id: newLog.id,
      timestamp: newLog.timestamp?.toISOString() || new Date().toISOString(),
      level: newLog.level,
      message: newLog.message,
      details: newLog.details,
    };
  }

  async getConfig(): Promise<Config> {
    const [record] = await db.select().from(configs).orderBy(desc(configs.id)).limit(1);
    
    if (!record) {
      return this.getDefaultConfig();
    }
    
    return {
      version: record.version,
      mode: record.mode,
      symbols: record.symbols.split(","),
      leverage: record.leverage,
      risk: {
        risk_per_trade_pct: record.riskPerTradePct,
        daily_max_loss_pct: record.dailyMaxLossPct,
        max_trades_per_day: record.maxTradesPerDay,
        max_consecutive_losses: record.maxConsecutiveLosses,
        pause_after_consecutive_losses_minutes: record.pauseAfterLossesMinutes,
        max_margin_per_trade_pct: record.maxMarginPerTradePct,
      },
      signal: {
        liq_window_seconds: record.liqWindowSeconds,
        min_liq_usd: { BTCUSDT: 2500000, ETHUSDT: 1250000 },
        volume_lookback: record.volumeLookback,
        volume_mult: record.volumeMult,
        exhaustion_candles: record.exhaustionCandles,
        max_spread_bps: { BTCUSDT: 3, ETHUSDT: 4 },
        symbol_cooldown_seconds: record.symbolCooldownSeconds,
      },
      execution: {
        tp_pct: record.tpPct,
        sl_pct: record.slPct,
        time_stop_seconds: record.timeStopSeconds,
        entry_fill_timeout_ms: record.entryFillTimeoutMs,
        use_market_if_not_filled: record.useMarketIfNotFilled,
      },
      feature_flags: {
        enable_sol: record.enableSol,
        enable_momentum_variant: record.enableMomentumVariant,
      },
    };
  }

  private getDefaultConfig(): Config {
    return {
      version: 1,
      mode: "paper",
      symbols: ["BTCUSDT", "ETHUSDT"],
      leverage: 2,
      risk: {
        risk_per_trade_pct: 0.0025,
        daily_max_loss_pct: 0.015,
        max_trades_per_day: 10,
        max_consecutive_losses: 3,
        pause_after_consecutive_losses_minutes: 60,
        max_margin_per_trade_pct: 0.20,
      },
      signal: {
        liq_window_seconds: 60,
        min_liq_usd: { BTCUSDT: 2500000, ETHUSDT: 1250000 },
        volume_lookback: 20,
        volume_mult: 2.0,
        exhaustion_candles: 2,
        max_spread_bps: { BTCUSDT: 3, ETHUSDT: 4 },
        symbol_cooldown_seconds: 300,
      },
      execution: {
        tp_pct: 0.0035,
        sl_pct: 0.0045,
        time_stop_seconds: 150,
        entry_fill_timeout_ms: 800,
        use_market_if_not_filled: true,
      },
      feature_flags: {
        enable_sol: false,
        enable_momentum_variant: false,
      },
    };
  }

  async updateConfig(updates: Partial<Config>): Promise<Config> {
    const current = await this.getConfig();
    
    const [existing] = await db.select().from(configs).orderBy(desc(configs.id)).limit(1);
    
    const newConfig = {
      version: (current.version || 0) + 1,
      mode: updates.mode || current.mode,
      symbols: (updates.symbols || current.symbols).join(","),
      leverage: updates.leverage ?? current.leverage,
      riskPerTradePct: updates.risk?.risk_per_trade_pct ?? current.risk.risk_per_trade_pct,
      dailyMaxLossPct: updates.risk?.daily_max_loss_pct ?? current.risk.daily_max_loss_pct,
      maxTradesPerDay: updates.risk?.max_trades_per_day ?? current.risk.max_trades_per_day,
      maxConsecutiveLosses: updates.risk?.max_consecutive_losses ?? current.risk.max_consecutive_losses,
      pauseAfterLossesMinutes: updates.risk?.pause_after_consecutive_losses_minutes ?? current.risk.pause_after_consecutive_losses_minutes,
      maxMarginPerTradePct: updates.risk?.max_margin_per_trade_pct ?? current.risk.max_margin_per_trade_pct,
      liqWindowSeconds: updates.signal?.liq_window_seconds ?? current.signal.liq_window_seconds,
      volumeLookback: updates.signal?.volume_lookback ?? current.signal.volume_lookback,
      volumeMult: updates.signal?.volume_mult ?? current.signal.volume_mult,
      exhaustionCandles: updates.signal?.exhaustion_candles ?? current.signal.exhaustion_candles,
      symbolCooldownSeconds: updates.signal?.symbol_cooldown_seconds ?? current.signal.symbol_cooldown_seconds,
      tpPct: updates.execution?.tp_pct ?? current.execution.tp_pct,
      slPct: updates.execution?.sl_pct ?? current.execution.sl_pct,
      timeStopSeconds: updates.execution?.time_stop_seconds ?? current.execution.time_stop_seconds,
      entryFillTimeoutMs: updates.execution?.entry_fill_timeout_ms ?? current.execution.entry_fill_timeout_ms,
      useMarketIfNotFilled: updates.execution?.use_market_if_not_filled ?? current.execution.use_market_if_not_filled,
      enableSol: updates.feature_flags?.enable_sol ?? current.feature_flags.enable_sol,
      enableMomentumVariant: updates.feature_flags?.enable_momentum_variant ?? current.feature_flags.enable_momentum_variant,
      updatedAt: new Date(),
    };
    
    if (existing) {
      await db.update(configs).set(newConfig).where(eq(configs.id, existing.id));
    } else {
      await db.insert(configs).values(newConfig);
    }
    
    return this.getConfig();
  }

  async getChecklist(): Promise<ChecklistItem[]> {
    const state = await this.getBotState();
    const metricsData = await this.getMetrics();
    const health = await this.getHealth();
    const openPos = await this.getOpenPosition();
    
    return [
      {
        id: "services",
        label: "All services online",
        description: "Bot, API, WebSocket, Database",
        status: health.apiConnected && health.wsConnected && health.dbConnected ? "ok" : "error",
        value: null,
      },
      {
        id: "risk_limits",
        label: "No risk limits hit",
        description: "Daily loss, consecutive losses",
        status: state.status === "PAUSED_RISK_LIMIT" ? "error" : 
                metricsData.consecutiveLosses >= 2 ? "warning" : "ok",
        value: null,
      },
      {
        id: "errors",
        label: "No repeated errors",
        description: "Check error logs",
        status: state.lastError ? "warning" : "ok",
        value: state.lastError ? "1 error" : null,
      },
      {
        id: "pnl",
        label: "PnL within expected band",
        description: "Today's performance",
        status: metricsData.todayPnlPct < -0.01 ? "error" :
                metricsData.todayPnlPct < 0 ? "warning" : "ok",
        value: `${(metricsData.todayPnlPct * 100).toFixed(2)}%`,
      },
      {
        id: "positions",
        label: "Open positions manageable",
        description: "Current exposure",
        status: "ok",
        value: openPos ? "1 open" : "None",
      },
      {
        id: "trades",
        label: "Trade count and win rate",
        description: "Last 24 hours",
        status: metricsData.winRate >= 0.5 ? "ok" : metricsData.todayTradeCount > 0 ? "warning" : "ok",
        value: `${metricsData.todayTradeCount} trades, ${(metricsData.winRate * 100).toFixed(0)}% WR`,
      },
    ];
  }

  async getHealth(): Promise<HealthCheck> {
    const [record] = await db.select().from(healthChecks).orderBy(desc(healthChecks.id)).limit(1);
    
    if (!record) {
      return {
        status: "healthy",
        apiConnected: false,
        wsConnected: false,
        dbConnected: true,
        lastCheck: new Date().toISOString(),
      };
    }
    
    return {
      status: record.status,
      apiConnected: record.apiConnected,
      wsConnected: record.wsConnected,
      dbConnected: record.dbConnected,
      lastCheck: record.lastCheck?.toISOString() || new Date().toISOString(),
    };
  }

  async updateHealth(updates: Partial<HealthCheck>): Promise<HealthCheck> {
    const [existing] = await db.select().from(healthChecks).orderBy(desc(healthChecks.id)).limit(1);
    
    if (existing) {
      await db.update(healthChecks).set({
        status: updates.status || existing.status,
        apiConnected: updates.apiConnected ?? existing.apiConnected,
        wsConnected: updates.wsConnected ?? existing.wsConnected,
        dbConnected: updates.dbConnected ?? existing.dbConnected,
        lastCheck: new Date(),
      }).where(eq(healthChecks.id, existing.id));
    } else {
      await db.insert(healthChecks).values({
        status: updates.status || "healthy",
        apiConnected: updates.apiConnected ?? false,
        wsConnected: updates.wsConnected ?? false,
        dbConnected: updates.dbConnected ?? true,
        lastCheck: new Date(),
      });
    }
    
    return this.getHealth();
  }
}

export const storage = new DatabaseStorage();
