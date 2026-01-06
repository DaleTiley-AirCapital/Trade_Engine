import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Pause,
  Play,
  XCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Database,
  Server,
} from "lucide-react";
import type { BotState, HealthCheck } from "@shared/schema";

function ControlsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface HealthItemProps {
  label: string;
  status: boolean;
  icon: React.ReactNode;
}

function HealthItem({ label, status, icon }: HealthItemProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            status ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          {icon}
        </div>
        <span className="font-medium">{label}</span>
      </div>
      {status ? (
        <Badge className="gap-1 bg-success text-success-foreground">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Disconnected
        </Badge>
      )}
    </div>
  );
}

export default function Controls() {
  const { toast } = useToast();
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const { data: botState, isLoading: stateLoading } = useQuery<BotState>({
    queryKey: ["/api/state"],
    refetchInterval: 5000,
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthCheck>({
    queryKey: ["/api/health"],
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/control/pause");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      toast({
        title: "Bot paused",
        description: "Trading has been paused. No new entries will be made.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to pause",
        description: "There was an error pausing the bot.",
        variant: "destructive",
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/control/resume");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      toast({
        title: "Bot resumed",
        description: "Trading has been resumed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to resume",
        description: "There was an error resuming the bot.",
        variant: "destructive",
      });
    },
  });

  const flattenMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/control/flatten");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      toast({
        title: "Position flattened",
        description: "All open positions have been closed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to flatten",
        description: "There was an error flattening positions.",
        variant: "destructive",
      });
    },
  });

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    await refetchHealth();
    setIsCheckingHealth(false);
    toast({
      title: "Health check complete",
      description: "System connectivity has been verified.",
    });
  };

  const isRunning = botState?.status === "RUNNING";
  const isPaused = botState?.status === "PAUSED_MANUAL" || botState?.status === "PAUSED_RISK_LIMIT";
  const canResume = isPaused && botState?.status !== "PAUSED_RISK_LIMIT";

  if (stateLoading || healthLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Controls</h1>
        <ControlsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Controls</h1>
        {botState && <StatusBadge status={botState.status} size="lg" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Bot Controls
            </CardTitle>
            <CardDescription>
              Manage bot state and trading operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant={isRunning ? "destructive" : "outline"}
              className="w-full h-12"
              onClick={() => pauseMutation.mutate()}
              disabled={!isRunning || pauseMutation.isPending}
              data-testid="button-pause"
            >
              <Pause className="h-4 w-4 mr-2" />
              {pauseMutation.isPending ? "Pausing..." : "Pause Trading"}
            </Button>

            <Button
              variant={canResume ? "default" : "outline"}
              className="w-full h-12"
              onClick={() => resumeMutation.mutate()}
              disabled={!canResume || resumeMutation.isPending}
              data-testid="button-resume"
            >
              <Play className="h-4 w-4 mr-2" />
              {resumeMutation.isPending ? "Resuming..." : "Resume Trading"}
            </Button>

            {botState?.status === "PAUSED_RISK_LIMIT" && (
              <p className="text-sm text-muted-foreground text-center">
                Cannot resume: risk limit has been hit
              </p>
            )}

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full h-12"
                    data-testid="button-flatten"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Emergency Flatten
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Emergency Flatten</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately close all open positions and cancel all pending orders.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-flatten-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => flattenMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-flatten-confirm"
                    >
                      {flattenMutation.isPending ? "Flattening..." : "Confirm Flatten"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Check connectivity and service status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <HealthItem
              label="Binance API"
              status={health?.apiConnected ?? false}
              icon={<Server className="h-4 w-4" />}
            />
            <HealthItem
              label="WebSocket Stream"
              status={health?.wsConnected ?? false}
              icon={health?.wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            />
            <HealthItem
              label="Database"
              status={health?.dbConnected ?? false}
              icon={<Database className="h-4 w-4" />}
            />

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleHealthCheck}
                disabled={isCheckingHealth}
                data-testid="button-health-check"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isCheckingHealth && "animate-spin")} />
                {isCheckingHealth ? "Checking..." : "Run Health Check"}
              </Button>
              {health?.lastCheck && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Last checked: {new Date(health.lastCheck).toLocaleTimeString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Pause Trading:</strong> Prevents new trade entries.
            Existing positions and orders remain active.
          </p>
          <p>
            <strong className="text-foreground">Resume Trading:</strong> Allows the bot to enter new
            trades when conditions are met. Only available if not hitting risk limits.
          </p>
          <p>
            <strong className="text-foreground">Emergency Flatten:</strong> Immediately closes all
            open positions at market price and cancels pending orders. Use only in emergencies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
