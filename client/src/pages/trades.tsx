import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import type { Trade } from "@shared/schema";

interface TradesResponse {
  trades: Trade[];
  total: number;
  page: number;
  pageSize: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const exitReasonColors: Record<string, string> = {
  TP: "bg-success text-success-foreground",
  SL: "bg-destructive text-destructive-foreground",
  TIME_STOP: "bg-warning text-warning-foreground",
  MANUAL: "bg-muted text-muted-foreground",
  FLATTEN: "bg-muted text-muted-foreground",
};

function TradesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {[...Array(8)].map((_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-16" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Trades() {
  const [symbol, setSymbol] = useState<string>("all");
  const [side, setSide] = useState<string>("all");
  const [exitReason, setExitReason] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const queryParams = new URLSearchParams();
  if (symbol !== "all") queryParams.set("symbol", symbol);
  if (side !== "all") queryParams.set("side", side);
  if (exitReason !== "all") queryParams.set("exitReason", exitReason);
  queryParams.set("page", page.toString());
  queryParams.set("pageSize", pageSize.toString());

  const queryString = queryParams.toString();
  const url = `/api/trades${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<TradesResponse>({
    queryKey: [url],
    refetchInterval: 10000,
  });

  const trades = data?.trades || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const filteredTrades = trades.filter((trade) => {
    if (search) {
      return trade.setupId.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const winCount = trades.filter((t) => t.pnlUsdt > 0).length;
  const lossCount = trades.filter((t) => t.pnlUsdt <= 0).length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlUsdt, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Trade History</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span> total trades
          <span className="mx-2">|</span>
          <span className="text-success">{winCount}W</span>
          <span>/</span>
          <span className="text-destructive">{lossCount}L</span>
          <span className="mx-2">|</span>
          <span className={cn("font-medium", totalPnl >= 0 ? "text-success" : "text-destructive")}>
            ${totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by setup ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-48"
            data-testid="input-search"
          />
        </div>
        <Select value={symbol} onValueChange={(v) => { setSymbol(v); setPage(1); }}>
          <SelectTrigger className="w-32" data-testid="select-symbol">
            <SelectValue placeholder="Symbol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Symbols</SelectItem>
            <SelectItem value="BTCUSDT">BTCUSDT</SelectItem>
            <SelectItem value="ETHUSDT">ETHUSDT</SelectItem>
            <SelectItem value="SOLUSDT">SOLUSDT</SelectItem>
          </SelectContent>
        </Select>
        <Select value={side} onValueChange={(v) => { setSide(v); setPage(1); }}>
          <SelectTrigger className="w-28" data-testid="select-side">
            <SelectValue placeholder="Side" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            <SelectItem value="LONG">Long</SelectItem>
            <SelectItem value="SHORT">Short</SelectItem>
          </SelectContent>
        </Select>
        <Select value={exitReason} onValueChange={(v) => { setExitReason(v); setPage(1); }}>
          <SelectTrigger className="w-32" data-testid="select-exit-reason">
            <SelectValue placeholder="Exit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exits</SelectItem>
            <SelectItem value="TP">Take Profit</SelectItem>
            <SelectItem value="SL">Stop Loss</SelectItem>
            <SelectItem value="TIME_STOP">Time Stop</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSymbol("all"); setSide("all"); setExitReason("all"); setSearch(""); }}
          data-testid="button-clear-filters"
        >
          <Filter className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {isLoading ? (
        <TradesSkeleton />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead className="w-[100px]">Symbol</TableHead>
                    <TableHead className="w-[80px]">Side</TableHead>
                    <TableHead className="w-[110px]">Entry</TableHead>
                    <TableHead className="w-[110px]">Exit</TableHead>
                    <TableHead className="w-[100px]">PnL</TableHead>
                    <TableHead className="w-[90px]">Duration</TableHead>
                    <TableHead className="w-[80px]">Exit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No trades found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTrades.map((trade) => (
                      <TableRow key={trade.id} data-testid={`trade-row-${trade.id}`}>
                        <TableCell className="font-mono text-xs">
                          {formatTimestamp(trade.entryTimestamp)}
                        </TableCell>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.side === "LONG" ? "default" : "secondary"}>
                            {trade.side}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          ${trade.entryPrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono">
                          ${trade.exitPrice.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "flex items-center font-medium",
                              trade.pnlUsdt >= 0 ? "text-success" : "text-destructive"
                            )}
                          >
                            {trade.pnlUsdt >= 0 ? (
                              <ArrowUpRight className="h-4 w-4 mr-1" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 mr-1" />
                            )}
                            ${Math.abs(trade.pnlUsdt).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDuration(trade.duration)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", exitReasonColors[trade.exitReason])}>
                            {trade.exitReason}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
