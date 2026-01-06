import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  testId?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  className,
  testId,
}: MetricCardProps) {
  return (
    <Card className={cn("min-h-[120px]", className)}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-2">
          <span
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            data-testid={testId ? `${testId}-label` : undefined}
          >
            {label}
          </span>
          <span
            className="text-3xl font-bold"
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </span>
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "flex items-center text-sm",
                  trend === "up" && "text-success",
                  trend === "down" && "text-destructive",
                  trend === "neutral" && "text-muted-foreground"
                )}
              >
                {trend === "up" && <TrendingUp className="mr-1 h-4 w-4" />}
                {trend === "down" && <TrendingDown className="mr-1 h-4 w-4" />}
                {trend === "neutral" && <Minus className="mr-1 h-4 w-4" />}
                {trendValue}
              </span>
            )}
            {subValue && (
              <span className="text-sm text-muted-foreground">{subValue}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
