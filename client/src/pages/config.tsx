import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Save, RotateCcw, Settings2, Shield, Zap, ToggleLeft } from "lucide-react";
import type { Config } from "@shared/schema";

const configFormSchema = z.object({
  leverage: z.number().min(1).max(3),
  risk_per_trade_pct: z.number().min(0.001).max(0.01),
  daily_max_loss_pct: z.number().min(0.005).max(0.05),
  max_trades_per_day: z.number().min(1).max(20),
  max_consecutive_losses: z.number().min(1).max(10),
  tp_pct: z.number().min(0.0025).max(0.0045),
  sl_pct: z.number().min(0.0035).max(0.0050),
  time_stop_seconds: z.number().min(120).max(180),
  liq_window_seconds: z.number().min(30).max(120),
  volume_mult: z.number().min(1.5).max(5),
  exhaustion_candles: z.number().min(1).max(5),
  symbol_cooldown_seconds: z.number().min(60).max(600),
  enable_sol: z.boolean(),
  enable_momentum_variant: z.boolean(),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

function ConfigSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  multiplier?: number;
  onChange: (value: number) => void;
  testId: string;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  multiplier = 1,
  onChange,
  testId,
}: SliderFieldProps) {
  const displayValue = value * multiplier;
  const displayMin = min * multiplier;
  const displayMax = max * multiplier;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-medium" data-testid={`${testId}-value`}>
          {displayValue.toFixed(multiplier >= 100 ? 2 : multiplier >= 1 ? 1 : 4)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        data-testid={testId}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{displayMin.toFixed(multiplier >= 100 ? 2 : 1)}{unit}</span>
        <span>{displayMax.toFixed(multiplier >= 100 ? 2 : 1)}{unit}</span>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<Config>({
    queryKey: ["/api/config/current"],
  });

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      leverage: 2,
      risk_per_trade_pct: 0.0025,
      daily_max_loss_pct: 0.015,
      max_trades_per_day: 10,
      max_consecutive_losses: 3,
      tp_pct: 0.0035,
      sl_pct: 0.0045,
      time_stop_seconds: 150,
      liq_window_seconds: 60,
      volume_mult: 2.0,
      exhaustion_candles: 2,
      symbol_cooldown_seconds: 300,
      enable_sol: false,
      enable_momentum_variant: false,
    },
    values: config ? {
      leverage: config.leverage,
      risk_per_trade_pct: config.risk.risk_per_trade_pct,
      daily_max_loss_pct: config.risk.daily_max_loss_pct,
      max_trades_per_day: config.risk.max_trades_per_day,
      max_consecutive_losses: config.risk.max_consecutive_losses,
      tp_pct: config.execution.tp_pct,
      sl_pct: config.execution.sl_pct,
      time_stop_seconds: config.execution.time_stop_seconds,
      liq_window_seconds: config.signal.liq_window_seconds,
      volume_mult: config.signal.volume_mult,
      exhaustion_candles: config.signal.exhaustion_candles,
      symbol_cooldown_seconds: config.signal.symbol_cooldown_seconds,
      enable_sol: config.feature_flags.enable_sol,
      enable_momentum_variant: config.feature_flags.enable_momentum_variant,
    } : undefined,
  });

  const publishMutation = useMutation({
    mutationFn: async (values: ConfigFormValues) => {
      return apiRequest("POST", "/api/config/publish", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/current"] });
      toast({
        title: "Configuration saved",
        description: "Your changes have been published successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save",
        description: "There was an error saving your configuration.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ConfigFormValues) => {
    publishMutation.mutate(values);
  };

  const handleReset = () => {
    form.reset();
    toast({
      title: "Changes reverted",
      description: "Configuration reset to last saved state.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <ConfigSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Configuration</h1>
          {config && (
            <Badge variant="outline">v{config.version}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!form.formState.isDirty}
            data-testid="button-reset"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={!form.formState.isDirty || publishMutation.isPending}
            data-testid="button-publish"
          >
            <Save className="h-4 w-4 mr-2" />
            {publishMutation.isPending ? "Saving..." : "Publish"}
          </Button>
        </div>
      </div>

      <form className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Risk Management
            </CardTitle>
            <CardDescription>
              Control risk exposure and loss limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderField
              label="Leverage"
              value={form.watch("leverage")}
              min={1}
              max={3}
              step={0.5}
              unit="x"
              onChange={(v) => form.setValue("leverage", v, { shouldDirty: true })}
              testId="slider-leverage"
            />
            <SliderField
              label="Risk Per Trade"
              value={form.watch("risk_per_trade_pct")}
              min={0.001}
              max={0.01}
              step={0.0005}
              unit="%"
              multiplier={100}
              onChange={(v) => form.setValue("risk_per_trade_pct", v, { shouldDirty: true })}
              testId="slider-risk-per-trade"
            />
            <SliderField
              label="Daily Max Loss"
              value={form.watch("daily_max_loss_pct")}
              min={0.005}
              max={0.05}
              step={0.005}
              unit="%"
              multiplier={100}
              onChange={(v) => form.setValue("daily_max_loss_pct", v, { shouldDirty: true })}
              testId="slider-daily-max-loss"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Trades/Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  {...form.register("max_trades_per_day", { valueAsNumber: true })}
                  data-testid="input-max-trades"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Consec. Losses</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  {...form.register("max_consecutive_losses", { valueAsNumber: true })}
                  data-testid="input-max-losses"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5" />
              Execution
            </CardTitle>
            <CardDescription>
              Trade entry and exit parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderField
              label="Take Profit"
              value={form.watch("tp_pct")}
              min={0.0025}
              max={0.0045}
              step={0.0005}
              unit="%"
              multiplier={100}
              onChange={(v) => form.setValue("tp_pct", v, { shouldDirty: true })}
              testId="slider-tp"
            />
            <SliderField
              label="Stop Loss"
              value={form.watch("sl_pct")}
              min={0.0035}
              max={0.005}
              step={0.0005}
              unit="%"
              multiplier={100}
              onChange={(v) => form.setValue("sl_pct", v, { shouldDirty: true })}
              testId="slider-sl"
            />
            <SliderField
              label="Time Stop"
              value={form.watch("time_stop_seconds")}
              min={120}
              max={180}
              step={10}
              unit="s"
              onChange={(v) => form.setValue("time_stop_seconds", v, { shouldDirty: true })}
              testId="slider-time-stop"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-5 w-5" />
              Signal Detection
            </CardTitle>
            <CardDescription>
              Liquidation and exhaustion parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderField
              label="Liquidation Window"
              value={form.watch("liq_window_seconds")}
              min={30}
              max={120}
              step={10}
              unit="s"
              onChange={(v) => form.setValue("liq_window_seconds", v, { shouldDirty: true })}
              testId="slider-liq-window"
            />
            <SliderField
              label="Volume Multiplier"
              value={form.watch("volume_mult")}
              min={1.5}
              max={5}
              step={0.5}
              unit="x"
              onChange={(v) => form.setValue("volume_mult", v, { shouldDirty: true })}
              testId="slider-volume-mult"
            />
            <SliderField
              label="Exhaustion Candles"
              value={form.watch("exhaustion_candles")}
              min={1}
              max={5}
              step={1}
              onChange={(v) => form.setValue("exhaustion_candles", v, { shouldDirty: true })}
              testId="slider-exhaustion"
            />
            <SliderField
              label="Symbol Cooldown"
              value={form.watch("symbol_cooldown_seconds")}
              min={60}
              max={600}
              step={30}
              unit="s"
              onChange={(v) => form.setValue("symbol_cooldown_seconds", v, { shouldDirty: true })}
              testId="slider-cooldown"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ToggleLeft className="h-5 w-5" />
              Feature Flags
            </CardTitle>
            <CardDescription>
              Enable or disable experimental features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Enable SOLUSDT</Label>
                <p className="text-sm text-muted-foreground">
                  Trade SOL/USDT perpetuals
                </p>
              </div>
              <Switch
                checked={form.watch("enable_sol")}
                onCheckedChange={(checked) =>
                  form.setValue("enable_sol", checked, { shouldDirty: true })
                }
                data-testid="switch-enable-sol"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Momentum Variant</Label>
                <p className="text-sm text-muted-foreground">
                  Use momentum-based entry signals
                </p>
              </div>
              <Switch
                checked={form.watch("enable_momentum_variant")}
                onCheckedChange={(checked) =>
                  form.setValue("enable_momentum_variant", checked, { shouldDirty: true })
                }
                data-testid="switch-enable-momentum"
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
