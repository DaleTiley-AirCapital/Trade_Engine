import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Activity, Filter } from "lucide-react";
import type { MarketEvent } from "@shared/schema";

interface SignalsResponse {
  events: MarketEvent[];
  total: number;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatLiquidation(usd: number): string {
  if (usd >= 1_000_000) {
    return `$${(usd / 1_000_000).toFixed(2)}M`;
  }
  return `$${(usd / 1_000).toFixed(0)}K`;
}

function SignalsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SignalCardProps {
  event: MarketEvent;
}

function SignalCard({ event }: SignalCardProps) {
  const isPassed = event.passed;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        !isPassed && "opacity-60"
      )}
      data-testid={`signal-card-${event.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              isPassed ? "bg-success/10" : "bg-muted"
            )}
          >
            {isPassed ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{event.symbol}</span>
              <Badge
                variant={event.liquidationSide === "LONG" ? "default" : "secondary"}
                className="gap-1"
              >
                {event.liquidationSide === "LONG" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {event.liquidationSide} Liq
              </Badge>
              <Badge variant={isPassed ? "outline" : "secondary"}>
                {isPassed ? "Passed" : "Rejected"}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono">{formatLiquidation(event.liquidationUsd)}</span>
              <span>Volume: {event.volumeMult.toFixed(1)}x</span>
              <span>Spread: {event.spreadBps.toFixed(1)} bps</span>
            </div>
            {!isPassed && event.rejectionReason && (
              <p className="mt-2 text-sm text-muted-foreground">
                Reason: {event.rejectionReason}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
            <div>{formatDate(event.timestamp)}</div>
            <div className="font-mono">{formatTimestamp(event.timestamp)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Signals() {
  const [symbol, setSymbol] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const queryParams = new URLSearchParams();
  if (symbol !== "all") queryParams.set("symbol", symbol);
  if (status !== "all") queryParams.set("status", status);
  const queryString = queryParams.toString();
  const eventsUrl = `/api/events${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<SignalsResponse>({
    queryKey: [eventsUrl],
    refetchInterval: 5000,
  });

  const events = data?.events || [];

  const filteredEvents = events.filter((event) => {
    if (symbol !== "all" && event.symbol !== symbol) return false;
    if (status === "passed" && !event.passed) return false;
    if (status === "rejected" && event.passed) return false;
    return true;
  });

  const passedCount = events.filter((e) => e.passed).length;
  const rejectedCount = events.filter((e) => !e.passed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Market Signals</h1>
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />
            {events.length} events
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-success">{passedCount} passed</span>
          <span className="mx-1">|</span>
          <span className="text-destructive">{rejectedCount} rejected</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={symbol} onValueChange={setSymbol}>
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-28" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSymbol("all"); setStatus("all"); }}
          data-testid="button-clear-filters"
        >
          <Filter className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {isLoading ? (
        <SignalsSkeleton />
      ) : (
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-3 pr-4">
            {filteredEvents.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No signals found</p>
                </CardContent>
              </Card>
            ) : (
              filteredEvents.map((event) => (
                <SignalCard key={event.id} event={event} />
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
