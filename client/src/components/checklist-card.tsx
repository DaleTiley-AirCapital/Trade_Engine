import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";
import type { ChecklistItem } from "@shared/schema";

interface ChecklistCardProps {
  items: ChecklistItem[];
  className?: string;
}

const statusIcons = {
  ok: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
  pending: Clock,
};

const statusColors = {
  ok: "text-success",
  warning: "text-warning",
  error: "text-destructive",
  pending: "text-muted-foreground",
};

export function ChecklistCard({ items, className }: ChecklistCardProps) {
  const okCount = items.filter((item) => item.status === "ok").length;
  const progress = (okCount / items.length) * 100;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-4 text-lg font-semibold">
          <span>Daily Health Check</span>
          <span className="text-sm font-normal text-muted-foreground">
            {okCount}/{items.length} checks passed
          </span>
        </CardTitle>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const Icon = statusIcons[item.status];
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 py-2"
              data-testid={`checklist-item-${item.id}`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn("h-5 w-5", statusColors[item.status])}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </div>
              </div>
              {item.value && (
                <span className="text-sm text-muted-foreground">
                  {item.value}
                </span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
