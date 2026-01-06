import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

// Validation schema for config form values
const configFormSchema = z.object({
  leverage: z.number().min(1).max(3),
  risk_per_trade_pct: z.number().min(0.001).max(0.01),
  daily_max_loss_pct: z.number().min(0.005).max(0.05),
  max_trades_per_day: z.number().min(1).max(20),
  max_consecutive_losses: z.number().min(1).max(10),
  tp_pct: z.number().min(0.0025).max(0.0045),
  sl_pct: z.number().min(0.0035).max(0.0050),
  time_stop_seconds: z.number().min(120).max(180),
  liq_window_seconds: z.number().min(30).max(120),
  volume_mult: z.number().min(1.5).max(5),
  exhaustion_candles: z.number().min(1).max(5),
  symbol_cooldown_seconds: z.number().min(60).max(600),
  enable_sol: z.boolean(),
  enable_momentum_variant: z.boolean(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Health endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const health = await storage.getHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to get health status" });
    }
  });

  // Bot state endpoint
  app.get("/api/state", async (req, res) => {
    try {
      const state = await storage.getBotState();
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: "Failed to get bot state" });
    }
  });

  // Overview endpoint (combined data for dashboard)
  app.get("/api/overview", async (req, res) => {
    try {
      const [botState, metrics, openPosition, checklist] = await Promise.all([
        storage.getBotState(),
        storage.getMetrics(),
        storage.getOpenPosition(),
        storage.getChecklist(),
      ]);
      
      res.json({
        botState,
        metrics,
        openPosition,
        checklist,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get overview data" });
    }
  });

  // Metrics endpoint
  app.get("/api/metrics/today", async (req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Trades endpoint
  app.get("/api/trades", async (req, res) => {
    try {
      const { symbol, side, exitReason, page, pageSize } = req.query;
      const result = await storage.getTrades({
        symbol: symbol as string | undefined,
        side: side as string | undefined,
        exitReason: exitReason as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trades" });
    }
  });

  // Market events endpoint
  app.get("/api/events", async (req, res) => {
    try {
      const { symbol, status } = req.query;
      const result = await storage.getEvents({
        symbol: symbol as string | undefined,
        passed: status === "passed" ? true : status === "rejected" ? false : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  // Logs endpoint
  app.get("/api/logs", async (req, res) => {
    try {
      const { level, limit } = req.query;
      const result = await storage.getLogs({
        level: level as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  // Config endpoints
  app.get("/api/config/current", async (req, res) => {
    try {
      const config = await storage.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to get config" });
    }
  });

  app.post("/api/config/publish", async (req, res) => {
    try {
      // Validate request body
      const parseResult = configFormSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid configuration", 
          details: parseResult.error.flatten() 
        });
      }
      
      const updates = parseResult.data;
      
      // Build the config update from form values
      const configUpdate = {
        leverage: updates.leverage,
        risk: {
          risk_per_trade_pct: updates.risk_per_trade_pct,
          daily_max_loss_pct: updates.daily_max_loss_pct,
          max_trades_per_day: updates.max_trades_per_day,
          max_consecutive_losses: updates.max_consecutive_losses,
          pause_after_consecutive_losses_minutes: 60,
          max_margin_per_trade_pct: 0.20,
        },
        execution: {
          tp_pct: updates.tp_pct,
          sl_pct: updates.sl_pct,
          time_stop_seconds: updates.time_stop_seconds,
          entry_fill_timeout_ms: 800,
          use_market_if_not_filled: true,
        },
        signal: {
          liq_window_seconds: updates.liq_window_seconds,
          min_liq_usd: { BTCUSDT: 2500000, ETHUSDT: 1250000 },
          volume_lookback: 20,
          volume_mult: updates.volume_mult,
          exhaustion_candles: updates.exhaustion_candles,
          max_spread_bps: { BTCUSDT: 3, ETHUSDT: 4 },
          symbol_cooldown_seconds: updates.symbol_cooldown_seconds,
        },
        feature_flags: {
          enable_sol: updates.enable_sol,
          enable_momentum_variant: updates.enable_momentum_variant,
        },
      };
      
      const config = await storage.updateConfig(configUpdate);
      
      // Log the config update
      await storage.addLog({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Configuration updated to version ${config.version}`,
        details: null,
      });
      
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Control endpoints
  app.post("/api/control/pause", async (req, res) => {
    try {
      const state = await storage.updateBotState({
        status: "PAUSED_MANUAL",
      });
      
      await storage.addLog({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: "Bot paused by user",
        details: null,
      });
      
      res.json({ success: true, state });
    } catch (error) {
      res.status(500).json({ error: "Failed to pause bot" });
    }
  });

  app.post("/api/control/resume", async (req, res) => {
    try {
      const currentState = await storage.getBotState();
      
      // Can only resume from PAUSED_MANUAL
      if (currentState.status !== "PAUSED_MANUAL") {
        return res.status(400).json({ 
          error: "Cannot resume: bot is not in manual pause state" 
        });
      }
      
      const state = await storage.updateBotState({
        status: "RUNNING",
      });
      
      await storage.addLog({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: "Bot resumed by user",
        details: null,
      });
      
      res.json({ success: true, state });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume bot" });
    }
  });

  app.post("/api/control/flatten", async (req, res) => {
    try {
      // Close any open position
      await storage.setOpenPosition(null);
      
      // Pause the bot
      const state = await storage.updateBotState({
        status: "PAUSED_MANUAL",
      });
      
      await storage.addLog({
        timestamp: new Date().toISOString(),
        level: "WARN",
        message: "Emergency flatten executed by user - all positions closed",
        details: null,
      });
      
      res.json({ success: true, state });
    } catch (error) {
      res.status(500).json({ error: "Failed to flatten positions" });
    }
  });

  // Trading mode toggle endpoint
  app.post("/api/control/trading-mode", async (req, res) => {
    try {
      const { mode } = req.body;
      
      if (mode !== "paper" && mode !== "live") {
        return res.status(400).json({ error: "Invalid mode. Must be 'paper' or 'live'" });
      }
      
      const state = await storage.updateBotState({
        tradingMode: mode,
      });
      
      await storage.addLog({
        timestamp: new Date().toISOString(),
        level: mode === "live" ? "WARN" : "INFO",
        message: `Trading mode changed to ${mode.toUpperCase()}`,
        details: mode === "live" ? "CAUTION: Live mode will execute real trades!" : null,
      });
      
      res.json({ success: true, state });
    } catch (error) {
      res.status(500).json({ error: "Failed to update trading mode" });
    }
  });

  return httpServer;
}
