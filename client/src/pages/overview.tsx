import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import { ProgressBar } from "@/components/progress-bar";
import { OpenPositionCard } from "@/components/open-position-card";
import { ChecklistCard } from "@/components/checklist-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, Activity, TrendingUp, TrendingDown, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotState, Metrics, OpenPosition, ChecklistItem } from "@shared/schema";

interface OverviewData {
  botState: BotState;
  metrics: Metrics;
  openPosition: OpenPosition | null;
  checklist: ChecklistItem[];
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  lastUpdate: number;
}

function LivePriceStream() {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastTick, setLastTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const symbols = ["btcusdt", "ethusdt"];

  useEffect(() => {
    const streams = symbols.map(s => `${s}@ticker`).join("/");
    const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${streams}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.data) {
        const ticker = message.data;
        const symbol = ticker.s;
        const price = parseFloat(ticker.c);
        const change24h = parseFloat(ticker.P);
        
        setPrices(prev => {
          const newMap = new Map(prev);
          newMap.set(symbol, {
            symbol,
            price,
            change24h,
            lastUpdate: Date.now(),
          });
          return newMap;
        });
        setLastTick(Date.now());
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const formatPrice = (price: number, symbol: string) => {
    if (symbol.includes("BTC")) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getTimeSinceUpdate = () => {
    if (lastTick === 0) return "Connecting...";
    const seconds = Math.floor((Date.now() - lastTick) / 1000);
    if (seconds < 1) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    return "Stale";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Live Market Prices
          </CardTitle>
          <Badge 
            variant={isConnected ? "outline" : "destructive"}
            className="gap-1"
          >
            <Radio className={cn("h-3 w-3", isConnected && "animate-pulse text-success")} />
            {isConnected ? "Streaming" : "Disconnected"}
          </Badge>
        </div>
        <CardDescription>
          Real-time prices from Binance Futures WebSocket
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {symbols.map(s => {
            const symbol = s.toUpperCase();
            const data = prices.get(symbol);
            const isPositive = data && data.change24h >= 0;
            
            return (
              <div 
                key={symbol}
                className="flex items-center justify-between p-3 rounded-md bg-muted/50 border"
                data-testid={`price-${symbol}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-semibold">{symbol.replace("USDT", "")}</span>
                    <span className="text-xs text-muted-foreground">Perpetual</span>
                  </div>
                </div>
                <div className="text-right">
                  {data ? (
                    <>
                      <p className="font-mono text-lg font-semibold">
                        ${formatPrice(data.price, symbol)}
                      </p>
                      <div className={cn(
                        "flex items-center gap-1 text-xs justify-end",
                        isPositive ? "text-success" : "text-destructive"
                      )}>
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{isPositive ? "+" : ""}{data.change24h.toFixed(2)}%</span>
                      </div>
                    </>
                  ) : (
                    <Skeleton className="h-6 w-24" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Last update: {getTimeSinceUpdate()} | Signals evaluated instantly on liquidation events
        </p>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="min-h-[120px]">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function Overview() {
  const { data, isLoading, error } = useQuery<OverviewData>({
    queryKey: ["/api/overview"],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-destructive">Failed to load overview data</p>
        <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
      </div>
    );
  }

  const { botState, metrics, openPosition, checklist } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Overview</h1>
          <StatusBadge status={botState.status} size="lg" />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Last seen: {formatTimeAgo(botState.lastHeartbeat)}
          </Badge>
          <Badge variant={botState.tradingMode === "paper" ? "secondary" : "default"}>
            {botState.tradingMode.toUpperCase()} MODE
          </Badge>
        </div>
      </div>

      {botState.lastError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Last Error</p>
              <p className="text-sm text-muted-foreground">{botState.lastError}</p>
              {botState.errorTimestamp && (
                <p className="text-xs text-muted-foreground mt-1">
                  at {formatTimestamp(botState.errorTimestamp)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Equity"
          value={`$${metrics.equityUsdt.toLocaleString()}`}
          subValue={`R${metrics.equityZar.toLocaleString()}`}
          testId="metric-equity"
        />
        <MetricCard
          label="Today PnL"
          value={`$${metrics.todayPnlUsdt >= 0 ? "+" : ""}${metrics.todayPnlUsdt.toFixed(2)}`}
          trend={metrics.todayPnlUsdt >= 0 ? "up" : "down"}
          trendValue={`${(metrics.todayPnlPct * 100).toFixed(2)}%`}
          testId="metric-pnl"
        />
        <MetricCard
          label="Today Trades"
          value={metrics.todayTradeCount}
          subValue={`${metrics.todayWinCount}W / ${metrics.todayLossCount}L`}
          testId="metric-trades"
        />
        <MetricCard
          label="Win Rate"
          value={`${(metrics.winRate * 100).toFixed(1)}%`}
          trend={metrics.winRate >= 0.5 ? "up" : "down"}
          testId="metric-winrate"
        />
      </div>

      <LivePriceStream />

      <OpenPositionCard position={openPosition} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Risk Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar
              label="Daily Loss Used"
              value={Math.abs(metrics.todayPnlUsdt < 0 ? metrics.todayPnlUsdt : 0)}
              max={metrics.dailyLossRemaining + Math.abs(metrics.todayPnlUsdt < 0 ? metrics.todayPnlUsdt : 0)}
              unit="%"
              testId="progress-daily-loss"
            />
            <ProgressBar
              label="Trades Used Today"
              value={metrics.todayTradeCount}
              max={10}
              testId="progress-trades"
            />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Consecutive Losses</span>
              <Badge
                variant={metrics.consecutiveLosses >= 2 ? "destructive" : "secondary"}
                data-testid="badge-consecutive-losses"
              >
                {metrics.consecutiveLosses} / 3
              </Badge>
            </div>
          </CardContent>
        </Card>

        <ChecklistCard items={checklist} />
      </div>
    </div>
  );
}
