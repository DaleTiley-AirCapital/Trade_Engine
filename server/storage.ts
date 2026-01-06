import { randomUUID } from "crypto";
import type {
  BotState,
  Metrics,
  OpenPosition,
  Trade,
  MarketEvent,
  LogEntry,
  Config,
  ChecklistItem,
  HealthCheck,
  InsertTrade,
  InsertMarketEvent,
  InsertLogEntry,
} from "@shared/schema";

export interface IStorage {
  // Bot State
  getBotState(): Promise<BotState>;
  updateBotState(updates: Partial<BotState>): Promise<BotState>;
  
  // Metrics
  getMetrics(): Promise<Metrics>;
  updateMetrics(updates: Partial<Metrics>): Promise<Metrics>;
  
  // Open Position
  getOpenPosition(): Promise<OpenPosition | null>;
  setOpenPosition(position: OpenPosition | null): Promise<void>;
  
  // Trades
  getTrades(filters?: { symbol?: string; side?: string; exitReason?: string; page?: number; pageSize?: number }): Promise<{ trades: Trade[]; total: number }>;
  addTrade(trade: InsertTrade): Promise<Trade>;
  
  // Market Events
  getEvents(filters?: { symbol?: string; passed?: boolean }): Promise<{ events: MarketEvent[]; total: number }>;
  addEvent(event: InsertMarketEvent): Promise<MarketEvent>;
  
  // Logs
  getLogs(filters?: { level?: string; limit?: number }): Promise<{ logs: LogEntry[]; total: number }>;
  addLog(log: InsertLogEntry): Promise<LogEntry>;
  
  // Config
  getConfig(): Promise<Config>;
  updateConfig(config: Partial<Config>): Promise<Config>;
  
  // Checklist
  getChecklist(): Promise<ChecklistItem[]>;
  
  // Health
  getHealth(): Promise<HealthCheck>;
  updateHealth(health: Partial<HealthCheck>): Promise<HealthCheck>;
}

// Default config
const defaultConfig: Config = {
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
    min_liq_usd: {
      BTCUSDT: 2500000,
      ETHUSDT: 1250000,
    },
    volume_lookback: 20,
    volume_mult: 2.0,
    exhaustion_candles: 2,
    max_spread_bps: {
      BTCUSDT: 3,
      ETHUSDT: 4,
    },
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

// Sample data generators
function generateSampleTrades(): Trade[] {
  const symbols = ["BTCUSDT", "ETHUSDT"] as const;
  const sides = ["LONG", "SHORT"] as const;
  const exitReasons = ["TP", "SL", "TIME_STOP"] as const;
  const trades: Trade[] = [];
  
  const now = new Date();
  for (let i = 0; i < 25; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const exitReason = exitReasons[Math.floor(Math.random() * exitReasons.length)];
    const isWin = exitReason === "TP";
    const pnlPct = isWin ? 0.0025 + Math.random() * 0.002 : -(0.003 + Math.random() * 0.002);
    const entryPrice = symbol === "BTCUSDT" ? 95000 + Math.random() * 2000 : 3400 + Math.random() * 100;
    const exitPrice = entryPrice * (1 + pnlPct);
    const quantity = symbol === "BTCUSDT" ? 0.01 + Math.random() * 0.02 : 0.5 + Math.random() * 1;
    const pnlUsdt = entryPrice * quantity * pnlPct;
    
    const entryTime = new Date(now.getTime() - i * 3600000 - Math.random() * 1800000);
    const duration = 30 + Math.floor(Math.random() * 120);
    const exitTime = new Date(entryTime.getTime() + duration * 1000);
    
    trades.push({
      id: randomUUID(),
      symbol,
      side,
      entryPrice,
      exitPrice,
      quantity,
      pnlUsdt,
      pnlPct,
      duration,
      fees: Math.abs(pnlUsdt) * 0.04,
      slippageEst: Math.random() * 0.5,
      exitReason,
      entryTimestamp: entryTime.toISOString(),
      exitTimestamp: exitTime.toISOString(),
      setupId: `setup_${randomUUID().slice(0, 8)}`,
    });
  }
  
  return trades.sort((a, b) => 
    new Date(b.entryTimestamp).getTime() - new Date(a.entryTimestamp).getTime()
  );
}

function generateSampleEvents(): MarketEvent[] {
  const symbols = ["BTCUSDT", "ETHUSDT"] as const;
  const sides = ["LONG", "SHORT"] as const;
  const events: MarketEvent[] = [];
  
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const liquidationUsd = symbol === "BTCUSDT" 
      ? 1000000 + Math.random() * 4000000
      : 500000 + Math.random() * 2000000;
    const volumeMult = 1.5 + Math.random() * 3;
    const spreadBps = 1 + Math.random() * 5;
    const passed = volumeMult >= 2 && spreadBps <= 4 && 
      liquidationUsd >= (symbol === "BTCUSDT" ? 2500000 : 1250000);
    
    events.push({
      id: randomUUID(),
      timestamp: new Date(now.getTime() - i * 1800000 - Math.random() * 900000).toISOString(),
      symbol,
      liquidationUsd,
      liquidationSide: side,
      volumeMult,
      spreadBps,
      passed,
      rejectionReason: passed ? null : 
        volumeMult < 2 ? "Volume multiplier below threshold" :
        spreadBps > 4 ? "Spread too wide" :
        "Liquidation size below threshold",
    });
  }
  
  return events.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function generateSampleLogs(): LogEntry[] {
  const levels = ["INFO", "WARN", "ERROR"] as const;
  const messages = {
    INFO: [
      "Bot started successfully",
      "Connected to Binance API",
      "WebSocket stream connected",
      "Processing liquidation event",
      "Trade executed successfully",
      "Daily metrics reset",
      "Configuration updated",
      "Health check passed",
    ],
    WARN: [
      "High latency detected on WebSocket stream",
      "Approaching daily loss limit",
      "Spread above threshold, skipping signal",
      "Volume confirmation failed",
      "Order fill timeout, switching to market",
    ],
    ERROR: [
      "WebSocket connection lost, reconnecting...",
      "Failed to fetch account balance",
      "Order placement failed: insufficient margin",
    ],
  };
  
  const logs: LogEntry[] = [];
  const now = new Date();
  
  for (let i = 0; i < 100; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const levelMessages = messages[level];
    const message = levelMessages[Math.floor(Math.random() * levelMessages.length)];
    
    logs.push({
      id: randomUUID(),
      timestamp: new Date(now.getTime() - i * 300000 - Math.random() * 150000).toISOString(),
      level,
      message,
      details: level === "ERROR" ? `Stack trace:\n  at processSignal (/app/bot/strategy.ts:142)\n  at handleLiquidation (/app/bot/events.ts:56)` : null,
    });
  }
  
  return logs.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export class MemStorage implements IStorage {
  private botState: BotState;
  private metrics: Metrics;
  private openPosition: OpenPosition | null;
  private trades: Trade[];
  private events: MarketEvent[];
  private logs: LogEntry[];
  private config: Config;
  private health: HealthCheck;

  constructor() {
    // Initialize with sample data
    this.trades = generateSampleTrades();
    this.events = generateSampleEvents();
    this.logs = generateSampleLogs();
    
    // Calculate metrics from trades
    const todayTrades = this.trades.filter(t => {
      const tradeDate = new Date(t.entryTimestamp);
      const today = new Date();
      return tradeDate.toDateString() === today.toDateString();
    });
    
    const wins = todayTrades.filter(t => t.pnlUsdt > 0);
    const losses = todayTrades.filter(t => t.pnlUsdt <= 0);
    const todayPnl = todayTrades.reduce((sum, t) => sum + t.pnlUsdt, 0);
    
    this.botState = {
      id: randomUUID(),
      status: "RUNNING",
      lastHeartbeat: new Date().toISOString(),
      lastError: null,
      errorTimestamp: null,
      tradingMode: "paper",
      paperStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      paperTradesCount: this.trades.length,
    };
    
    const equity = 1400; // ~R25000 in USDT
    this.metrics = {
      equityUsdt: equity,
      equityZar: equity * 18.5,
      todayPnlUsdt: todayPnl,
      todayPnlPct: todayPnl / equity,
      todayMaxDrawdownPct: 0.008,
      dailyLossRemaining: equity * 0.015 - Math.abs(Math.min(0, todayPnl)),
      tradesRemaining: 10 - todayTrades.length,
      consecutiveLosses: 1,
      todayTradeCount: todayTrades.length,
      todayWinCount: wins.length,
      todayLossCount: losses.length,
      winRate: todayTrades.length > 0 ? wins.length / todayTrades.length : 0,
    };
    
    this.openPosition = null;
    this.config = defaultConfig;
    
    this.health = {
      status: "healthy",
      apiConnected: true,
      wsConnected: true,
      dbConnected: true,
      lastCheck: new Date().toISOString(),
    };
  }

  async getBotState(): Promise<BotState> {
    // Update heartbeat
    this.botState.lastHeartbeat = new Date().toISOString();
    return this.botState;
  }

  async updateBotState(updates: Partial<BotState>): Promise<BotState> {
    this.botState = { ...this.botState, ...updates };
    return this.botState;
  }

  async getMetrics(): Promise<Metrics> {
    return this.metrics;
  }

  async updateMetrics(updates: Partial<Metrics>): Promise<Metrics> {
    this.metrics = { ...this.metrics, ...updates };
    return this.metrics;
  }

  async getOpenPosition(): Promise<OpenPosition | null> {
    return this.openPosition;
  }

  async setOpenPosition(position: OpenPosition | null): Promise<void> {
    this.openPosition = position;
  }

  async getTrades(filters?: { symbol?: string; side?: string; exitReason?: string; page?: number; pageSize?: number }): Promise<{ trades: Trade[]; total: number }> {
    let filteredTrades = [...this.trades];
    
    if (filters?.symbol) {
      filteredTrades = filteredTrades.filter(t => t.symbol === filters.symbol);
    }
    if (filters?.side) {
      filteredTrades = filteredTrades.filter(t => t.side === filters.side);
    }
    if (filters?.exitReason) {
      filteredTrades = filteredTrades.filter(t => t.exitReason === filters.exitReason);
    }
    
    const total = filteredTrades.length;
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const paginatedTrades = filteredTrades.slice(start, start + pageSize);
    
    return { trades: paginatedTrades, total };
  }

  async addTrade(trade: InsertTrade): Promise<Trade> {
    const newTrade: Trade = {
      ...trade,
      id: randomUUID(),
    };
    this.trades.unshift(newTrade);
    return newTrade;
  }

  async getEvents(filters?: { symbol?: string; passed?: boolean }): Promise<{ events: MarketEvent[]; total: number }> {
    let filteredEvents = [...this.events];
    
    if (filters?.symbol) {
      filteredEvents = filteredEvents.filter(e => e.symbol === filters.symbol);
    }
    if (filters?.passed !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.passed === filters.passed);
    }
    
    return { events: filteredEvents, total: filteredEvents.length };
  }

  async addEvent(event: InsertMarketEvent): Promise<MarketEvent> {
    const newEvent: MarketEvent = {
      ...event,
      id: randomUUID(),
    };
    this.events.unshift(newEvent);
    return newEvent;
  }

  async getLogs(filters?: { level?: string; limit?: number }): Promise<{ logs: LogEntry[]; total: number }> {
    let filteredLogs = [...this.logs];
    
    if (filters?.level) {
      filteredLogs = filteredLogs.filter(l => l.level === filters.level);
    }
    
    const limit = filters?.limit || 100;
    const paginatedLogs = filteredLogs.slice(0, limit);
    
    return { logs: paginatedLogs, total: filteredLogs.length };
  }

  async addLog(log: InsertLogEntry): Promise<LogEntry> {
    const newLog: LogEntry = {
      ...log,
      id: randomUUID(),
    };
    this.logs.unshift(newLog);
    return newLog;
  }

  async getConfig(): Promise<Config> {
    return this.config;
  }

  async updateConfig(updates: Partial<Config>): Promise<Config> {
    this.config = {
      ...this.config,
      ...updates,
      version: this.config.version + 1,
    };
    return this.config;
  }

  async getChecklist(): Promise<ChecklistItem[]> {
    const state = this.botState;
    const metrics = this.metrics;
    const health = this.health;
    
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
                metrics.consecutiveLosses >= 2 ? "warning" : "ok",
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
        status: metrics.todayPnlPct < -0.01 ? "error" :
                metrics.todayPnlPct < 0 ? "warning" : "ok",
        value: `${(metrics.todayPnlPct * 100).toFixed(2)}%`,
      },
      {
        id: "positions",
        label: "Open positions manageable",
        description: "Current exposure",
        status: "ok",
        value: this.openPosition ? "1 open" : "None",
      },
      {
        id: "trades",
        label: "Trade count and win rate",
        description: "Last 24 hours",
        status: metrics.winRate >= 0.5 ? "ok" : "warning",
        value: `${metrics.todayTradeCount} trades, ${(metrics.winRate * 100).toFixed(0)}% WR`,
      },
    ];
  }

  async getHealth(): Promise<HealthCheck> {
    return this.health;
  }

  async updateHealth(updates: Partial<HealthCheck>): Promise<HealthCheck> {
    this.health = { ...this.health, ...updates, lastCheck: new Date().toISOString() };
    return this.health;
  }
}

export const storage = new MemStorage();
