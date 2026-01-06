import { cn } from "@/lib/utils";
import type { BotStateType } from "@shared/schema";

interface StatusBadgeProps {
  status: BotStateType;
  size?: "sm" | "lg";
  className?: string;
}

const statusConfig: Record<BotStateType, { label: string; className: string }> = {
  BOOTING: {
    label: "Booting",
    className: "bg-muted text-muted-foreground",
  },
  RUNNING: {
    label: "Running",
    className: "bg-success text-success-foreground",
  },
  PAUSED_MANUAL: {
    label: "Paused",
    className: "bg-warning text-warning-foreground",
  },
  PAUSED_RISK_LIMIT: {
    label: "Risk Limit",
    className: "bg-warning text-warning-foreground",
  },
  ERROR: {
    label: "Error",
    className: "bg-destructive text-destructive-foreground",
  },
  SHUTDOWN: {
    label: "Shutdown",
    className: "bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" ? "px-3 py-1 text-xs" : "px-6 py-2 text-sm",
        config.className,
        className
      )}
      data-testid="status-badge"
    >
      <span
        className={cn(
          "mr-2 h-2 w-2 rounded-full",
          status === "RUNNING" && "bg-success-foreground animate-pulse",
          status === "ERROR" && "bg-destructive-foreground animate-pulse",
          (status === "PAUSED_MANUAL" || status === "PAUSED_RISK_LIMIT") && "bg-warning-foreground",
          (status === "BOOTING" || status === "SHUTDOWN") && "bg-muted-foreground"
        )}
      />
      {config.label}
    </span>
  );
}
