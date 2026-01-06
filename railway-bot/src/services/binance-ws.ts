import WebSocket from "ws";
import { EventEmitter } from "events";
import { logger } from "./logger";

interface LiquidationData {
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  usdValue: number;
  timestamp: number;
}

interface TradeData {
  symbol: string;
  price: number;
  quantity: number;
  isBuyerMaker: boolean;
  timestamp: number;
}

interface BookTickerData {
  symbol: string;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  timestamp: number;
}

export class BinanceWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnected = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private symbols: string[];
  
  // Price cache for fast access
  private prices: Map<string, number> = new Map();
  private bookTickers: Map<string, BookTickerData> = new Map();
  
  constructor(symbols: string[] = ["BTCUSDT", "ETHUSDT"]) {
    super();
    this.symbols = symbols;
  }
  
  async connect(): Promise<void> {
    const streams = this.symbols
      .map(s => [
        `${s.toLowerCase()}@aggTrade`,
        `${s.toLowerCase()}@bookTicker`,
      ])
      .flat()
      .concat(["!forceOrder@arr"]); // Liquidation stream
    
    const url = `wss://fstream.binance.com/stream?streams=${streams.join("/")}`;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.on("open", () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info("Binance WebSocket connected");
          this.emit("connected");
          this.startPingInterval();
          resolve();
        });
        
        this.ws.on("message", (data: Buffer) => {
          try {
            this.handleMessage(JSON.parse(data.toString()));
          } catch (err) {
            logger.error("Failed to parse WebSocket message", String(err));
          }
        });
        
        this.ws.on("error", (error) => {
          logger.error("WebSocket error", String(error));
          this.emit("error", error);
        });
        
        this.ws.on("close", () => {
          this.isConnected = false;
          this.stopPingInterval();
          logger.warn("WebSocket disconnected");
          this.emit("disconnected");
          this.reconnect();
        });
        
      } catch (err) {
        reject(err);
      }
    });
  }
  
  private handleMessage(data: any) {
    if (!data.stream || !data.data) return;
    
    const stream = data.stream;
    const payload = data.data;
    
    // Liquidation events
    if (stream === "!forceOrder@arr" || stream.includes("forceOrder")) {
      const liq = payload.o;
      if (liq && this.symbols.includes(liq.s)) {
        const liquidation: LiquidationData = {
          symbol: liq.s,
          side: liq.S,
          price: parseFloat(liq.p),
          quantity: parseFloat(liq.q),
          usdValue: parseFloat(liq.p) * parseFloat(liq.q),
          timestamp: liq.T,
        };
        this.emit("liquidation", liquidation);
      }
    }
    
    // Aggregate trades - for volume and price updates
    if (stream.includes("@aggTrade")) {
      const trade: TradeData = {
        symbol: payload.s,
        price: parseFloat(payload.p),
        quantity: parseFloat(payload.q),
        isBuyerMaker: payload.m,
        timestamp: payload.T,
      };
      this.prices.set(trade.symbol, trade.price);
      this.emit("trade", trade);
    }
    
    // Book ticker - for spread calculation and fast price
    if (stream.includes("@bookTicker")) {
      const ticker: BookTickerData = {
        symbol: payload.s,
        bidPrice: parseFloat(payload.b),
        bidQty: parseFloat(payload.B),
        askPrice: parseFloat(payload.a),
        askQty: parseFloat(payload.A),
        timestamp: Date.now(),
      };
      this.bookTickers.set(ticker.symbol, ticker);
      this.prices.set(ticker.symbol, (ticker.bidPrice + ticker.askPrice) / 2);
      this.emit("bookTicker", ticker);
    }
  }
  
  getPrice(symbol: string): number | undefined {
    return this.prices.get(symbol);
  }
  
  getBookTicker(symbol: string): BookTickerData | undefined {
    return this.bookTickers.get(symbol);
  }
  
  getSpreadBps(symbol: string): number {
    const ticker = this.bookTickers.get(symbol);
    if (!ticker) return 999;
    const midPrice = (ticker.bidPrice + ticker.askPrice) / 2;
    return ((ticker.askPrice - ticker.bidPrice) / midPrice) * 10000;
  }
  
  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }
  
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  private async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached");
      this.emit("maxReconnectAttempts");
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (err) {
      logger.error("Reconnection failed", String(err));
    }
  }
  
  async disconnect() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  get connected(): boolean {
    return this.isConnected;
  }
}
