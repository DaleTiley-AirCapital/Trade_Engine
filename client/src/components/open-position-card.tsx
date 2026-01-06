import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import type { OpenPosition } from "@shared/schema";

interface OpenPositionCardProps {
  position: OpenPosition | null;
  className?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function OpenPositionCard({ position, className }: OpenPositionCardProps) {
  if (!position) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No open position</p>
        </CardContent>
      </Card>
    );
  }

  const isProfit = position.unrealizedPnlUsdt >= 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Open Position</CardTitle>
        <Badge
          variant={position.side === "LONG" ? "default" : "secondary"}
          data-testid="position-side"
        >
          {position.side}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Symbol
            </span>
            <p className="text-lg font-semibold" data-testid="position-symbol">
              {position.symbol}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Entry Price
            </span>
            <p className="text-lg font-semibold" data-testid="position-entry">
              ${position.entryPrice.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unrealized PnL
            </span>
            <p
              className={cn(
                "flex items-center text-lg font-semibold",
                isProfit ? "text-success" : "text-destructive"
              )}
              data-testid="position-pnl"
            >
              {isProfit ? (
                <ArrowUpRight className="mr-1 h-4 w-4" />
              ) : (
                <ArrowDownRight className="mr-1 h-4 w-4" />
              )}
              ${Math.abs(position.unrealizedPnlUsdt).toFixed(2)} (
              {(position.unrealizedPnlPct * 100).toFixed(2)}%)
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Time in Trade
            </span>
            <p
              className="flex items-center text-lg font-semibold"
              data-testid="position-time"
            >
              <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
              {formatDuration(position.timeInTrade)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
