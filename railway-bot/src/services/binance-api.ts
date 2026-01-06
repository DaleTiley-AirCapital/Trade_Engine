import crypto from "crypto";
import { logger } from "./logger";

interface OrderResult {
  orderId: number;
  symbol: string;
  side: "BUY" | "SELL";
  positionSide: string;
  type: string;
  price: number;
  avgPrice: number;
  origQty: number;
  executedQty: number;
  status: string;
  updateTime: number;
}

interface AccountBalance {
  asset: string;
  balance: number;
  availableBalance: number;
}

interface Position {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  unrealizedProfit: number;
  leverage: number;
  positionSide: string;
}

export class BinanceAPI {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = "https://fapi.binance.com";
  private isPaper: boolean;
  
  constructor(apiKey: string, apiSecret: string, isPaper = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.isPaper = isPaper;
    
    // Use testnet for paper trading
    if (isPaper) {
      this.baseUrl = "https://testnet.binancefuture.com";
    }
  }
  
  private sign(params: Record<string, string | number>): string {
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }
  
  private async request(
    method: string,
    endpoint: string,
    params: Record<string, string | number> = {},
    signed = false
  ): Promise<any> {
    if (signed) {
      params.timestamp = Date.now();
      params.signature = this.sign(params);
    }
    
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    
    const url = `${this.baseUrl}${endpoint}${queryString ? "?" + queryString : ""}`;
    
    const options: RequestInit = {
      method,
      headers: {
        "X-MBX-APIKEY": this.apiKey,
        "Content-Type": "application/json",
      },
    };
    
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${JSON.stringify(data)}`);
      }
      
      return data;
    } catch (err) {
      logger.error(`API request failed: ${endpoint}`, String(err));
      throw err;
    }
  }
  
  // Set leverage for a symbol
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.request("POST", "/fapi/v1/leverage", {
      symbol,
      leverage,
    }, true);
    logger.info(`Leverage set to ${leverage}x for ${symbol}`);
  }
  
  // Get account balance
  async getBalance(): Promise<AccountBalance[]> {
    const data = await this.request("GET", "/fapi/v2/balance", {}, true);
    return data.map((b: any) => ({
      asset: b.asset,
      balance: parseFloat(b.balance),
      availableBalance: parseFloat(b.availableBalance),
    }));
  }
  
  // Get USDT balance
  async getUsdtBalance(): Promise<number> {
    const balances = await this.getBalance();
    const usdt = balances.find(b => b.asset === "USDT");
    return usdt?.availableBalance || 0;
  }
  
  // Get open positions
  async getPositions(): Promise<Position[]> {
    const data = await this.request("GET", "/fapi/v2/positionRisk", {}, true);
    return data
      .filter((p: any) => parseFloat(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: p.symbol,
        positionAmt: parseFloat(p.positionAmt),
        entryPrice: parseFloat(p.entryPrice),
        unrealizedProfit: parseFloat(p.unRealizedProfit),
        leverage: parseInt(p.leverage),
        positionSide: p.positionSide,
      }));
  }
  
  // Place market order - FAST execution
  async marketOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number
  ): Promise<OrderResult> {
    const startTime = Date.now();
    
    const data = await this.request("POST", "/fapi/v1/order", {
      symbol,
      side,
      type: "MARKET",
      quantity: quantity.toFixed(3),
    }, true);
    
    const latency = Date.now() - startTime;
    logger.info(`Market order executed in ${latency}ms: ${side} ${quantity} ${symbol}`);
    
    return {
      orderId: data.orderId,
      symbol: data.symbol,
      side: data.side,
      positionSide: data.positionSide,
      type: data.type,
      price: parseFloat(data.price),
      avgPrice: parseFloat(data.avgPrice),
      origQty: parseFloat(data.origQty),
      executedQty: parseFloat(data.executedQty),
      status: data.status,
      updateTime: data.updateTime,
    };
  }
  
  // Place limit order with IOC (Immediate-Or-Cancel) for speed
  async limitOrderIOC(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    price: number
  ): Promise<OrderResult> {
    const startTime = Date.now();
    
    const data = await this.request("POST", "/fapi/v1/order", {
      symbol,
      side,
      type: "LIMIT",
      timeInForce: "IOC",
      quantity: quantity.toFixed(3),
      price: price.toFixed(2),
    }, true);
    
    const latency = Date.now() - startTime;
    logger.info(`IOC limit order in ${latency}ms: ${side} ${quantity} ${symbol} @ ${price}`);
    
    return {
      orderId: data.orderId,
      symbol: data.symbol,
      side: data.side,
      positionSide: data.positionSide,
      type: data.type,
      price: parseFloat(data.price),
      avgPrice: parseFloat(data.avgPrice),
      origQty: parseFloat(data.origQty),
      executedQty: parseFloat(data.executedQty),
      status: data.status,
      updateTime: data.updateTime,
    };
  }
  
  // Close all positions (flatten)
  async closeAllPositions(): Promise<void> {
    const positions = await this.getPositions();
    
    for (const pos of positions) {
      const side = pos.positionAmt > 0 ? "SELL" : "BUY";
      const qty = Math.abs(pos.positionAmt);
      
      await this.marketOrder(pos.symbol, side, qty);
      logger.info(`Closed position: ${pos.symbol}`);
    }
  }
  
  // Get symbol info for precision
  async getSymbolInfo(symbol: string): Promise<{ pricePrecision: number; quantityPrecision: number }> {
    const data = await this.request("GET", "/fapi/v1/exchangeInfo", {});
    const symbolInfo = data.symbols.find((s: any) => s.symbol === symbol);
    
    return {
      pricePrecision: symbolInfo?.pricePrecision || 2,
      quantityPrecision: symbolInfo?.quantityPrecision || 3,
    };
  }
}
