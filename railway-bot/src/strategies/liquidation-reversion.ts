import { BinanceWebSocket } from "../services/binance-ws";
import { BinanceAPI } from "../services/binance-api";
import { logger } from "../services/logger";
import { db } from "../db";
import { trades, marketEvents, metrics, botStates, healthChecks } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";

interface LiquidationSignal {
  symbol: string;
  side: "BUY" | "SELL";
  usdValue: number;
  timestamp: number;
}

interface Config {
  symbols: string[];
  leverage: number;
  riskPerTradePct: number;
  dailyMaxLossPct: number;
  maxTradesPerDay: number;
  maxConsecutiveLosses: number;
  liqWindowSeconds: number;
  minLiqUsd: Record<string, number>;
  volumeMult: number;
  maxSpreadBps: Record<string, number>;
  symbolCooldownSeconds: number;
  tpPct: number;
  slPct: number;
  timeStopSeconds: number;
  entryFillTimeoutMs: number;
}

export class LiquidationReversionStrategy {
  private ws: BinanceWebSocket;
  private api: BinanceAPI;
  private config: Config;
  private isPaused = false;
  private isLive = false;
  
  // State tracking
  private recentLiquidations: Map<string, LiquidationSignal[]> = new Map();
  private recentVolumes: Map<string, number[]> = new Map();
  private symbolCooldowns: Map<string, number> = new Map();
  private openTrade: { symbol: string; entryPrice: number; side: "LONG" | "SHORT"; entryTime: number; tradeId: number } | null = null;
  
  // Daily metrics
  private todayPnl = 0;
  private todayTradeCount = 0;
  private consecutiveLosses = 0;
  private equity = 1400; // Starting equity in USDT
  
  constructor(ws: BinanceWebSocket, api: BinanceAPI, config: Config, isLive = false) {
    this.ws = ws;
    this.api = api;
    this.config = config;
    this.isLive = isLive;
    
    // Initialize tracking for each symbol
    for (const symbol of config.symbols) {
      this.recentLiquidations.set(symbol, []);
      this.recentVolumes.set(symbol, []);
    }
  }
  
  async start() {
    logger.info("Starting Liquidation Reversion Strategy");
    logger.info(`Mode: ${this.isLive ? "LIVE TRADING" : "PAPER TRADING (no real orders)"}`);
    
    // Update bot state
    await this.updateBotState("RUNNING");
    await this.updateHealth(true, true, true);
    
    // In paper mode, skip API calls that require trading permissions
    if (this.isLive) {
      // Set leverage on all symbols
      for (const symbol of this.config.symbols) {
        try {
          await this.api.setLeverage(symbol, this.config.leverage);
        } catch (err) {
          logger.warn(`Failed to set leverage for ${symbol}`, String(err));
        }
      }
      
      // Get initial equity from account
      try {
        this.equity = await this.api.getUsdtBalance();
        logger.info(`Starting equity: $${this.equity.toFixed(2)}`);
      } catch (err) {
        logger.warn("Could not fetch initial balance, using default");
      }
    } else {
      // Paper mode - use default equity
      logger.info(`[PAPER] Using simulated equity: $${this.equity.toFixed(2)}`);
    }
    
    // Listen for liquidation events
    this.ws.on("liquidation", (liq: LiquidationSignal) => {
      this.onLiquidation(liq);
    });
    
    // Listen for trade updates for volume tracking
    this.ws.on("trade", (trade: any) => {
      this.onTrade(trade);
    });
    
    // Start position monitoring loop
    this.startPositionMonitor();
    
    // Start heartbeat
    this.startHeartbeat();
    
    logger.info("Strategy started successfully");
  }
  
  private async onLiquidation(liq: LiquidationSignal) {
    if (this.isPaused) return;
    if (this.openTrade) return; // Already in a trade
    
    const symbol = liq.symbol;
    if (!this.config.symbols.includes(symbol)) return;
    
    // Check cooldown first (don't log cooldown events)
    const cooldownUntil = this.symbolCooldowns.get(symbol) || 0;
    if (Date.now() < cooldownUntil) {
      return; // Skip cooldown events entirely
    }
    
    // ============================================
    // CALCULATE ALL CRITERIA UPFRONT
    // ============================================
    
    // 1. Spread check
    const spreadBps = this.ws.getSpreadBps(symbol);
    const maxSpread = this.config.maxSpreadBps[symbol] || 4;
    const spreadOk = spreadBps <= maxSpread;
    
    // 2. Volume multiplier check
    const avgVolume = this.getAverageVolume(symbol);
    const recentVolume = this.getRecentVolume(symbol, 60);
    const volumeMult = avgVolume > 0 ? recentVolume / avgVolume : 0;
    const volumeOk = volumeMult >= this.config.volumeMult;
    
    // 3. Liquidation size check
    const minLiq = this.config.minLiqUsd[symbol] || 2000000;
    const liqSizeOk = liq.usdValue >= minLiq;
    
    // 4. Price momentum (delta) check - measure price change in last minute
    const priceDelta = this.ws.getPriceDelta(symbol, 60);
    const momentumOk = Math.abs(priceDelta) < 0.5; // Momentum slowing if delta < 0.5%
    
    // 5. Exhaustion candles check - count candles that failed to extend
    const exhaustionCandles = this.ws.getExhaustionCandles(symbol);
    const exhaustionOk = exhaustionCandles >= 1; // At least 1 exhaustion candle
    
    // ============================================
    // CHECK DAILY LIMITS (separate from signal quality)
    // ============================================
    const dailyLimitOk = this.todayTradeCount < this.config.maxTradesPerDay;
    const consecutiveLossOk = this.consecutiveLosses < this.config.maxConsecutiveLosses;
    const dailyLossPct = Math.abs(Math.min(0, this.todayPnl)) / this.equity;
    const dailyLossOk = dailyLossPct < this.config.dailyMaxLossPct;
    
    // ============================================
    // DETERMINE OVERALL PASS/FAIL
    // ============================================
    const signalQualityPassed = liqSizeOk && volumeOk && spreadOk && momentumOk && exhaustionOk;
    const riskLimitsPassed = dailyLimitOk && consecutiveLossOk && dailyLossOk;
    const allPassed = signalQualityPassed && riskLimitsPassed;
    
    // Build rejection reason listing all failures
    const failures: string[] = [];
    if (!liqSizeOk) failures.push(`Liq size $${(liq.usdValue/1000).toFixed(0)}K < $${(minLiq/1000000).toFixed(1)}M`);
    if (!volumeOk) failures.push(`Volume ${volumeMult.toFixed(2)}x < ${this.config.volumeMult}x`);
    if (!spreadOk) failures.push(`Spread ${spreadBps.toFixed(1)}bps > ${maxSpread}bps`);
    if (!momentumOk) failures.push(`Momentum ${priceDelta.toFixed(2)}% still strong`);
    if (!exhaustionOk) failures.push(`No exhaustion candles (${exhaustionCandles})`);
    if (!dailyLimitOk) failures.push("Daily trade limit");
    if (!consecutiveLossOk) failures.push("Consecutive losses limit");
    if (!dailyLossOk) failures.push("Daily loss limit");
    
    const rejectionReason = failures.length > 0 ? failures.join("; ") : null;
    
    // ============================================
    // LOG THE EVENT WITH ALL CRITERIA
    // ============================================
    await this.logMarketEvent(symbol, liq, allPassed, rejectionReason, {
      volumeMult,
      spreadBps,
      priceDelta,
      exhaustionCandles,
      liqSizeOk,
      volumeOk,
      spreadOk,
      momentumOk,
      exhaustionOk,
    });
    
    // Handle risk limit pausing
    if (!riskLimitsPassed) {
      if (!consecutiveLossOk || !dailyLossOk) {
        await this.updateBotState("PAUSED_RISK_LIMIT");
        this.isPaused = true;
      }
      return;
    }
    
    // If signal quality failed, don't trade
    if (!signalQualityPassed) {
      return;
    }
    
    // Signal passed! Execute trade
    logger.info(`SIGNAL PASSED: ${symbol} - Liq: $${(liq.usdValue / 1000000).toFixed(2)}M, Vol: ${volumeMult.toFixed(2)}x, Spread: ${spreadBps.toFixed(1)}bps`);
    
    // Trade in opposite direction of liquidation
    const tradeSide = liq.side === "BUY" ? "SHORT" : "LONG";
    await this.enterTrade(symbol, tradeSide);
  }
  
  private async enterTrade(symbol: string, side: "LONG" | "SHORT") {
    const price = this.ws.getPrice(symbol);
    if (!price) {
      logger.error(`No price available for ${symbol}`);
      return;
    }
    
    // Calculate position size
    const riskAmount = this.equity * this.config.riskPerTradePct;
    const slDistance = price * this.config.slPct;
    const quantity = riskAmount / slDistance;
    
    const orderSide = side === "LONG" ? "BUY" : "SELL";
    
    try {
      const startTime = Date.now();
      let avgPrice = price;
      let executedQty = quantity;
      let slippage = 0;
      
      // In paper mode, simulate the trade instead of executing
      if (!this.isLive) {
        // Simulate small slippage (0.01-0.03%)
        slippage = 0.01 + Math.random() * 0.02;
        avgPrice = side === "LONG" 
          ? price * (1 + slippage / 100)
          : price * (1 - slippage / 100);
        logger.info(`[PAPER] Simulated ${side} ${symbol} @ ${avgPrice.toFixed(2)} (simulated slippage: ${slippage.toFixed(3)}%)`);
      } else {
        // Live mode - execute real order
        const order = await this.api.marketOrder(symbol, orderSide, quantity);
        avgPrice = order.avgPrice;
        executedQty = order.executedQty;
        slippage = Math.abs(order.avgPrice - price) / price * 100;
      }
      
      const executionTime = Date.now() - startTime;
      logger.info(`Trade opened: ${side} ${symbol} @ ${avgPrice.toFixed(2)} (slippage: ${slippage.toFixed(3)}%, exec: ${executionTime}ms)`);
      
      // Record trade in database
      const [newTrade] = await db.insert(trades).values({
        symbol,
        side,
        entryPrice: avgPrice,
        quantity: executedQty,
        isOpen: true,
        setupId: `liq_${Date.now()}`,
        slippageEst: slippage,
      }).returning();
      
      this.openTrade = {
        symbol,
        entryPrice: avgPrice,
        side,
        entryTime: Date.now(),
        tradeId: newTrade.id,
      };
      
      // Set cooldown
      this.symbolCooldowns.set(symbol, Date.now() + this.config.symbolCooldownSeconds * 1000);
      
      // Update metrics
      this.todayTradeCount++;
      await this.updateMetrics();
      
    } catch (err) {
      logger.error(`Failed to enter trade: ${symbol} ${side}`, String(err));
    }
  }
  
  private startPositionMonitor() {
    setInterval(async () => {
      if (!this.openTrade) return;
      
      const { symbol, entryPrice, side, entryTime, tradeId } = this.openTrade;
      const currentPrice = this.ws.getPrice(symbol);
      if (!currentPrice) return;
      
      const pnlPct = side === "LONG"
        ? (currentPrice - entryPrice) / entryPrice
        : (entryPrice - currentPrice) / entryPrice;
      
      const timeInTrade = (Date.now() - entryTime) / 1000;
      
      // Check exit conditions
      let exitReason: string | null = null;
      
      if (pnlPct >= this.config.tpPct) {
        exitReason = "TP";
      } else if (pnlPct <= -this.config.slPct) {
        exitReason = "SL";
      } else if (timeInTrade >= this.config.timeStopSeconds) {
        exitReason = "TIME_STOP";
      }
      
      if (exitReason) {
        await this.exitTrade(exitReason);
      }
    }, 100); // Check every 100ms for fast exits
  }
  
  private async exitTrade(exitReason: string) {
    if (!this.openTrade) return;
    
    const { symbol, entryPrice, side, entryTime, tradeId } = this.openTrade;
    const orderSide = side === "LONG" ? "SELL" : "BUY";
    
    try {
      const exitPrice = this.ws.getPrice(symbol) || entryPrice;
      let quantity = 0;
      
      // In paper mode, simulate the exit
      if (!this.isLive) {
        // Use the quantity from when we entered
        quantity = (this.equity * this.config.riskPerTradePct) / (entryPrice * this.config.slPct);
        logger.info(`[PAPER] Simulated exit ${side} ${symbol} @ ${exitPrice.toFixed(2)}`);
      } else {
        // Live mode - execute real order
        const positions = await this.api.getPositions();
        const pos = positions.find(p => p.symbol === symbol);
        
        if (pos) {
          quantity = Math.abs(pos.positionAmt);
          await this.api.marketOrder(symbol, orderSide, quantity);
        }
      }
      
      const pnlPct = side === "LONG"
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice;
      
      const pnlUsdt = entryPrice * quantity * pnlPct;
      const duration = Math.floor((Date.now() - entryTime) / 1000);
      const fees = Math.abs(pnlUsdt) * 0.04;
      
      logger.info(`Trade closed: ${side} ${symbol} - PnL: $${pnlUsdt.toFixed(2)} (${(pnlPct * 100).toFixed(2)}%) - ${exitReason}`);
      
      // Update trade in database
      await db.update(trades)
        .set({
          exitPrice,
          pnlUsdt,
          pnlPct,
          duration,
          fees,
          exitReason,
          exitTimestamp: new Date(),
          isOpen: false,
        })
        .where(eq(trades.id, tradeId));
      
      // Update metrics
      this.todayPnl += pnlUsdt;
      if (pnlUsdt >= 0) {
        this.consecutiveLosses = 0;
      } else {
        this.consecutiveLosses++;
      }
      
      await this.updateMetrics();
      
      this.openTrade = null;
      
    } catch (err) {
      logger.error(`Failed to exit trade`, String(err));
    }
  }
  
  private onTrade(trade: any) {
    const symbol = trade.symbol;
    const volumes = this.recentVolumes.get(symbol) || [];
    volumes.push(trade.quantity * trade.price);
    
    // Keep last 1000 trades
    if (volumes.length > 1000) {
      volumes.shift();
    }
    
    this.recentVolumes.set(symbol, volumes);
  }
  
  private getAverageVolume(symbol: string): number {
    const volumes = this.recentVolumes.get(symbol) || [];
    if (volumes.length === 0) return 0;
    return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }
  
  private getRecentVolume(symbol: string, seconds: number): number {
    const volumes = this.recentVolumes.get(symbol) || [];
    // Approximate: take last N samples
    const samples = Math.min(volumes.length, seconds * 10);
    const recent = volumes.slice(-samples);
    return recent.reduce((a, b) => a + b, 0) / Math.max(1, samples);
  }
  
  private async logMarketEvent(
    symbol: string,
    liq: LiquidationSignal,
    passed: boolean,
    rejectionReason: string | null,
    criteria: {
      volumeMult: number;
      spreadBps: number;
      priceDelta: number;
      exhaustionCandles: number;
      liqSizeOk: boolean;
      volumeOk: boolean;
      spreadOk: boolean;
      momentumOk: boolean;
      exhaustionOk: boolean;
    }
  ) {
    await db.insert(marketEvents).values({
      symbol,
      liquidationUsd: liq.usdValue,
      liquidationSide: liq.side === "BUY" ? "LONG" : "SHORT",
      volumeMult: criteria.volumeMult,
      spreadBps: criteria.spreadBps,
      priceDelta: criteria.priceDelta,
      exhaustionCandles: criteria.exhaustionCandles,
      liqSizeOk: criteria.liqSizeOk,
      volumeOk: criteria.volumeOk,
      spreadOk: criteria.spreadOk,
      momentumOk: criteria.momentumOk,
      exhaustionOk: criteria.exhaustionOk,
      passed,
      rejectionReason,
    });
  }
  
  private async updateBotState(status: string) {
    const [existing] = await db.select().from(botStates).orderBy(desc(botStates.id)).limit(1);
    
    if (existing) {
      await db.update(botStates).set({
        status,
        lastHeartbeat: new Date(),
        tradingMode: this.isLive ? "live" : "paper",
      }).where(eq(botStates.id, existing.id));
    } else {
      await db.insert(botStates).values({
        status,
        tradingMode: this.isLive ? "live" : "paper",
      });
    }
  }
  
  private async updateHealth(api: boolean, ws: boolean, dbConn: boolean) {
    const [existing] = await db.select().from(healthChecks).orderBy(desc(healthChecks.id)).limit(1);
    
    const healthStatus = api && ws && dbConn ? "healthy" : "degraded";
    
    if (existing) {
      await db.update(healthChecks).set({
        status: healthStatus,
        apiConnected: api,
        wsConnected: ws,
        dbConnected: dbConn,
        lastCheck: new Date(),
      }).where(eq(healthChecks.id, existing.id));
    } else {
      await db.insert(healthChecks).values({
        status: healthStatus,
        apiConnected: api,
        wsConnected: ws,
        dbConnected: dbConn,
      });
    }
  }
  
  private async updateMetrics() {
    const winCount = this.todayPnl > 0 ? 1 : 0;
    const lossCount = this.todayPnl < 0 ? 1 : 0;
    
    const [existing] = await db.select().from(metrics).orderBy(desc(metrics.id)).limit(1);
    
    const metricsData = {
      equityUsdt: this.equity + this.todayPnl,
      equityZar: (this.equity + this.todayPnl) * 18.5,
      todayPnlUsdt: this.todayPnl,
      todayPnlPct: this.todayPnl / this.equity,
      todayMaxDrawdownPct: Math.abs(Math.min(0, this.todayPnl)) / this.equity,
      dailyLossRemaining: this.equity * this.config.dailyMaxLossPct - Math.abs(Math.min(0, this.todayPnl)),
      tradesRemaining: this.config.maxTradesPerDay - this.todayTradeCount,
      consecutiveLosses: this.consecutiveLosses,
      todayTradeCount: this.todayTradeCount,
      todayWinCount: winCount,
      todayLossCount: lossCount,
      winRate: this.todayTradeCount > 0 ? winCount / this.todayTradeCount : 0,
      date: new Date(),
    };
    
    if (existing) {
      await db.update(metrics).set(metricsData).where(eq(metrics.id, existing.id));
    } else {
      await db.insert(metrics).values(metricsData);
    }
  }
  
  private startHeartbeat() {
    setInterval(async () => {
      await db.update(botStates)
        .set({ lastHeartbeat: new Date() })
        .where(eq(botStates.id, 1));
      
      await this.updateHealth(true, this.ws.connected, true);
    }, 5000);
  }
  
  async pause() {
    this.isPaused = true;
    await this.updateBotState("PAUSED_MANUAL");
    logger.info("Strategy paused");
  }
  
  async resume() {
    this.isPaused = false;
    await this.updateBotState("RUNNING");
    logger.info("Strategy resumed");
  }
  
  setLiveMode(isLive: boolean) {
    const wasLive = this.isLive;
    this.isLive = isLive;
    if (wasLive !== isLive) {
      logger.info(`Trading mode updated: ${isLive ? "LIVE" : "PAPER"}`);
    }
  }
  
  async flatten() {
    logger.warn("EMERGENCY FLATTEN - Closing all positions");
    
    // In paper mode, just exit any simulated trade
    if (this.isLive) {
      await this.api.closeAllPositions();
    } else {
      logger.info("[PAPER] Simulated flatten - no real positions to close");
    }
    
    if (this.openTrade) {
      await this.exitTrade("FLATTEN");
    }
    await this.pause();
  }
}
