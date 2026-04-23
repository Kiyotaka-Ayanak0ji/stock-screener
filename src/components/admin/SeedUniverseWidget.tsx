import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, Loader2, Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SeedProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  status: "idle" | "running" | "paused";
  cycle_started_at: string | null;
  last_chunk_at: string | null;
}

interface SegmentCount {
  segment: string;
  count: number;
}

interface FailedStock {
  ticker: string;
  exchange: string;
  segment: string;
  name: string | null;
  last_status: string;
  error_message: string | null;
  last_seeded_at: string | null;
}

const formatRelative = (iso: string | null) => {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const SeedUniverseWidget = () => {
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [segments, setSegments] = useState<SegmentCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [failedOpen, setFailedOpen] = useState(false);
  const [failedLoading, setFailedLoading] = useState(false);
  const [failedStocks, setFailedStocks] = useState<FailedStock[]>([]);
  const [failedSearch, setFailedSearch] = useState("");

  const loadProgress = useCallback(async () => {
    const [{ data: prog }, { data: univ }] = await Promise.all([
      supabase.from("seed_job_progress" as never).select("*").eq("id", 1).maybeSingle(),
      supabase.from("stock_universe" as never).select("segment, exchange"),
    ]);

    if (prog) setProgress(prog as unknown as SeedProgress);

    if (univ) {
      const map = new Map<string, number>();
      (univ as Array<{ segment: string; exchange: string }>).forEach((r) => {
        const k = `${r.exchange} ${r.segment}`;
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      setSegments(Array.from(map.entries()).map(([segment, count]) => ({ segment, count })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProgress();
    const i = setInterval(loadProgress, 15000);
    return () => clearInterval(i);
  }, [loadProgress]);

  const loadFailedStocks = useCallback(async () => {
    setFailedLoading(true);
    const { data, error } = await supabase
      .from("stock_universe" as never)
      .select("ticker, exchange, segment, name, last_status, error_message, last_seeded_at")
      .eq("last_status", "failed")
      .order("last_seeded_at", { ascending: false })
      .limit(2000);

    if (error) {
      toast.error("Could not load failed stocks", { description: error.message });
    } else {
      setFailedStocks((data as unknown as FailedStock[]) ?? []);
    }
    setFailedLoading(false);
  }, []);

  const openFailedDialog = () => {
    setFailedOpen(true);
    setFailedSearch("");
    loadFailedStocks();
  };

  const callSeed = async (action: "ingest" | "process") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("You must be signed in");
      return null;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-stock-universe?action=${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    return res.json();
  };

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const res = await callSeed("ingest");
      if (res?.ok) {
        toast.success("Universe ingested", {
          description: `Loaded ${res.total} tickers from NSE + BSE`,
        });
        await loadProgress();
      } else {
        toast.error("Ingestion failed", { description: res?.error });
      }
    } finally {
      setIngesting(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await callSeed("process");
      if (res?.ok) {
        toast.success("Chunk processed", {
          description: `${res.succeeded}/${res.processed} succeeded`,
        });
        await loadProgress();
      } else {
        toast.error("Processing failed", { description: res?.error });
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const total = progress?.total ?? 0;
  const processed = progress?.processed ?? 0;
  const succeeded = progress?.succeeded ?? 0;
  const failed = progress?.failed ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  const filteredFailed = failedStocks.filter((s) => {
    if (!failedSearch.trim()) return true;
    const q = failedSearch.toLowerCase();
    return (
      s.ticker?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.error_message?.toLowerCase().includes(q)
    );
  });

  // Group error reasons for quick analysis
  const errorBuckets = new Map<string, number>();
  failedStocks.forEach((s) => {
    const key = (s.error_message ?? "Unknown error").slice(0, 80);
    errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1);
  });
  const topErrors = Array.from(errorBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Database className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Stock Universe Seeding</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Bulk-seeds NSE + BSE + SME tickers into the price cache over a 24-hour cycle
            </CardDescription>
          </div>
          <Badge
            variant={progress?.status === "running" ? "default" : "secondary"}
            className="capitalize shrink-0"
          >
            {progress?.status ?? "idle"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-4 sm:px-6">
        <div>
          <div className="flex items-center justify-between text-xs sm:text-sm mb-2 gap-2">
            <span className="text-muted-foreground truncate">
              {processed.toLocaleString()} / {total.toLocaleString()} processed
            </span>
            <span className="font-medium text-foreground shrink-0">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-border bg-card/50 p-2.5 sm:p-3 min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500 shrink-0" />
              <span className="truncate">Succeeded</span>
            </div>
            <p className="text-base sm:text-xl font-bold text-foreground truncate">{succeeded.toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={openFailedDialog}
            className="rounded-lg border border-border bg-card/50 p-2.5 sm:p-3 text-left transition-colors hover:bg-destructive/10 hover:border-destructive/40 focus:outline-none focus:ring-2 focus:ring-destructive/40 min-w-0"
            title="Click to view failed stock reports"
          >
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
              <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive shrink-0" />
              <span className="truncate">Failed</span>
              <span className="ml-auto text-[9px] sm:text-[10px] text-muted-foreground/70 hidden sm:inline">view →</span>
            </div>
            <p className="text-base sm:text-xl font-bold text-foreground truncate">{failed.toLocaleString()}</p>
          </button>
          <div className="rounded-lg border border-border bg-card/50 p-2.5 sm:p-3 min-w-0">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">Last chunk</div>
            <p className="text-xs sm:text-sm font-medium text-foreground truncate">
              {formatRelative(progress?.last_chunk_at ?? null)}
            </p>
          </div>
        </div>

        {segments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {segments.map((s) => (
              <Badge key={s.segment} variant="outline" className="text-xs">
                {s.segment}: {s.count.toLocaleString()}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleIngest}
            disabled={ingesting}
          >
            {ingesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Refresh ticker list
          </Button>
          <Button size="sm" onClick={handleProcess} disabled={processing}>
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            Process next chunk
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          A scheduled task runs every ~10 minutes to spread the full universe across the day.
          Use "Refresh ticker list" weekly to ingest new listings from NSE + BSE.
        </p>
      </CardContent>

      {/* Failed stocks dialog */}
      <Dialog open={failedOpen} onOpenChange={setFailedOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Failed Stock Reports
            </DialogTitle>
            <DialogDescription>
              Tickers that failed to seed in the latest cycle. Use this to diagnose missing or
              incorrect data in the watchlist dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {topErrors.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-foreground mb-2">Top failure reasons</p>
                <div className="flex flex-wrap gap-1.5">
                  {topErrors.map(([msg, count]) => (
                    <Badge key={msg} variant="outline" className="text-[11px] font-normal">
                      {msg} <span className="ml-1 text-destructive">×{count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                placeholder="Search ticker, name, or error..."
                value={failedSearch}
                onChange={(e) => setFailedSearch(e.target.value)}
                className="h-9"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadFailedStocks}
                disabled={failedLoading}
              >
                {failedLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {failedLoading
                ? "Loading…"
                : `${filteredFailed.length.toLocaleString()} of ${failedStocks.length.toLocaleString()} failed tickers`}
            </div>

            <ScrollArea className="h-[420px] rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[120px]">Ticker</TableHead>
                    <TableHead className="w-[80px]">Exch</TableHead>
                    <TableHead className="w-[80px]">Segment</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-[120px] text-right">Last attempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!failedLoading && filteredFailed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        No failed stocks found
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredFailed.map((s) => (
                    <TableRow key={`${s.exchange}:${s.ticker}`}>
                      <TableCell className="font-mono text-xs font-medium">{s.ticker}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.exchange}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.segment}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[420px]">
                        <div className="truncate" title={s.error_message ?? "Unknown"}>
                          {s.error_message ?? "Unknown error"}
                        </div>
                        {s.name && (
                          <div className="text-[10px] text-muted-foreground truncate">{s.name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelative(s.last_seeded_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
