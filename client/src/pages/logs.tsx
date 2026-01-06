import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Search, Filter, ChevronDown, FileText, AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { LogEntry, LogLevel } from "@shared/schema";

interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

const levelIcons = {
  INFO: Info,
  WARN: AlertTriangle,
  ERROR: AlertCircle,
};

const levelColors = {
  INFO: "bg-primary/10 text-primary",
  WARN: "bg-warning/10 text-warning",
  ERROR: "bg-destructive/10 text-destructive",
};

const levelBadgeColors = {
  INFO: "bg-primary text-primary-foreground",
  WARN: "bg-warning text-warning-foreground",
  ERROR: "bg-destructive text-destructive-foreground",
};

function LogsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

interface LogItemProps {
  log: LogEntry;
}

function LogItem({ log }: LogItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = levelIcons[log.level];
  const hasDetails = !!log.details;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-md transition-colors",
          hasDetails && "hover-elevate cursor-pointer"
        )}
        data-testid={`log-item-${log.id}`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-muted-foreground w-12">
            {formatTimestamp(log.timestamp)}
          </span>
          <Badge className={cn("text-xs font-medium", levelBadgeColors[log.level])}>
            {log.level}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono break-words">{log.message}</p>
          {hasDetails && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 px-2 text-xs text-muted-foreground"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 mr-1 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
                {isOpen ? "Hide" : "Show"} details
              </Button>
            </CollapsibleTrigger>
          )}
          <CollapsibleContent>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {log.details}
            </pre>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}

export default function Logs() {
  const [level, setLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const queryParams = new URLSearchParams();
  if (level !== "all") queryParams.set("level", level);
  queryParams.set("limit", limit.toString());
  const queryString = queryParams.toString();
  const logsUrl = `/api/logs${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading, refetch } = useQuery<LogsResponse>({
    queryKey: [logsUrl],
    refetchInterval: 5000,
  });

  const logs = data?.logs || [];

  const filteredLogs = logs.filter((log) => {
    if (level !== "all" && log.level !== level) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const errorCount = logs.filter((l) => l.level === "ERROR").length;
  const warnCount = logs.filter((l) => l.level === "WARN").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Logs</h1>
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            {logs.length} entries
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorCount} errors
            </Badge>
          )}
          {warnCount > 0 && (
            <Badge className="gap-1 bg-warning text-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              {warnCount} warnings
            </Badge>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 py-2 bg-background">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-28" data-testid="select-level">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
          <SelectTrigger className="w-24" data-testid="select-limit">
            <SelectValue placeholder="Limit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="500">500</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setLevel("all"); setSearch(""); }}
          data-testid="button-clear-filters"
        >
          <Filter className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LogsSkeleton />
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="divide-y">
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4" />
                    <p>No logs found</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => <LogItem key={log.id} log={log} />)
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
