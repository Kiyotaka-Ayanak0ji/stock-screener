import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, Loader2, Play, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Stock Universe Seeding
            </CardTitle>
            <CardDescription>
              Bulk-seeds NSE + BSE + SME tickers into the price cache over a 24-hour cycle
            </CardDescription>
          </div>
          <Badge
            variant={progress?.status === "running" ? "default" : "secondary"}
            className="capitalize"
          >
            {progress?.status ?? "idle"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {processed.toLocaleString()} / {total.toLocaleString()} processed this cycle
            </span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Succeeded
            </div>
            <p className="text-xl font-bold text-foreground">{succeeded.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <XCircle className="h-3.5 w-3.5 text-destructive" /> Failed
            </div>
            <p className="text-xl font-bold text-foreground">{failed.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3">
            <div className="text-xs text-muted-foreground mb-1">Last chunk</div>
            <p className="text-sm font-medium text-foreground">
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
    </Card>
  );
};
