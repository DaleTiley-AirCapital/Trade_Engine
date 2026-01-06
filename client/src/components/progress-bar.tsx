import { cn } from "@/lib/utils";

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  variant?: "default" | "warning" | "danger";
  className?: string;
  testId?: string;
}

export function ProgressBar({
  label,
  value,
  max,
  unit = "",
  variant = "default",
  className,
  testId,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  // Auto-detect variant based on percentage if not specified
  const autoVariant = variant === "default" 
    ? percentage > 80 
      ? "danger" 
      : percentage > 60 
        ? "warning" 
        : "default"
    : variant;

  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value.toFixed(2)}{unit} / {max.toFixed(2)}{unit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            autoVariant === "default" && "bg-primary",
            autoVariant === "warning" && "bg-warning",
            autoVariant === "danger" && "bg-destructive"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
