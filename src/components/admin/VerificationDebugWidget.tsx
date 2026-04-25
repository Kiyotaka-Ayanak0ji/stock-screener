import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Bug, Loader2, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

type SourceFields = Record<string, { filled: string[]; missing: string[] }>;

interface DebugLog {
  id: string;
  ticker: string;
  exchange: string;
  primary_source: string | null;
  sources_used: string[];
  source_fields: SourceFields;
  final_fields: Record<string, boolean>;
  final_values: Record<string, number>;
  bse_code: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

const SOURCE_COLORS: Record<string, string> = {
  screener: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  bse: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  google: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  groww: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  none: "bg-destructive/15 text-destructive border-destructive/30",
};

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function VerificationDebugWidget() {
  const [enabled, setEnabled] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(true);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadToggle = useCallback(async () => {
    setToggleLoading(true);
    const { data, error } = await supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", "verification_debug_enabled")
      .maybeSingle();
    if (!error && data) {
      setEnabled(data.value === true || data.value === "true");
    }
    setToggleLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("verification_debug_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Failed to load debug logs", { description: error.message });
    } else {
      setLogs((data ?? []) as unknown as DebugLog[]);
    }
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    loadToggle();
    loadLogs();
  }, [loadToggle, loadLogs]);

  const handleToggle = async (next: boolean) => {
    setEnabled(next); // optimistic
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings" as any)
      .upsert(
        {
          key: "verification_debug_enabled",
          value: next,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: "key" },
      );
    if (error) {
      setEnabled(!next); // rollback
      toast.error("Failed to update debug mode", { description: error.message });
      return;
    }
    toast.success(next ? "Debug mode enabled" : "Debug mode disabled", {
      description: next
        ? "Future verifications will record their data sources."
        : "New verifications will no longer be logged.",
    });
  };

  const handleClear = async () => {
    if (!confirm("Delete all verification debug logs? This cannot be undone.")) return;
    const { error } = await supabase
      .from("verification_debug_logs" as any)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error("Failed to clear logs", { description: error.message });
    } else {
      setLogs([]);
      toast.success("Debug logs cleared");
    }
  };

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Bug className="h-5 w-5 text-primary shrink-0" />
              Verification Debug Mode
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Track which source (Screener, BSE, Groww, Google) supplied each field for every
              "Verify against Screener.in" run. Visible to admins only.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="debug-toggle" className="text-sm font-medium">
              {enabled ? "On" : "Off"}
            </Label>
            {toggleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                id="debug-toggle"
                checked={enabled}
                onCheckedChange={handleToggle}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Showing latest {logs.length} run{logs.length === 1 ? "" : "s"}
            {!enabled && " (debug mode is off — no new runs are being recorded)"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={logsLoading}
              className="h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${logsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={logs.length === 0}
              className="h-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>

        {logsLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-md">
            No verification runs logged yet.
            {!enabled && " Enable debug mode and verify a stock to start."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => {
              const isOpen = expandedId === log.id;
              const ok = !log.error_message;
              return (
                <Collapsible
                  key={log.id}
                  open={isOpen}
                  onOpenChange={(open) => setExpandedId(open ? log.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 p-2.5 border rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {log.ticker}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {log.exchange}
                        </Badge>
                        {log.sources_used.map((src) => (
                          <span
                            key={src}
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                              SOURCE_COLORS[src] ?? ""
                            }`}
                          >
                            {src}
                          </span>
                        ))}
                        {!ok && (
                          <Badge variant="destructive" className="text-[10px] h-5">
                            error
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                        {log.duration_ms != null && <span>{log.duration_ms}ms</span>}
                        <span>{formatRelative(log.created_at)}</span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pt-2 pb-3 space-y-3 bg-muted/30 rounded-b-md border border-t-0 -mt-0.5">
                    {log.error_message && (
                      <div className="text-xs text-destructive">
                        <strong>Error:</strong> {log.error_message}
                      </div>
                    )}
                    {log.bse_code && (
                      <div className="text-xs text-muted-foreground">
                        Resolved BSE code: <span className="font-mono">{log.bse_code}</span>
                      </div>
                    )}

                    {/* Per-source field breakdown */}
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Per-source fields
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(log.source_fields).map(([src, info]) => (
                          <div key={src} className="text-xs">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium mr-2 ${
                                SOURCE_COLORS[src] ?? ""
                              }`}
                            >
                              {src}
                            </span>
                            {info.filled.length > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ✓ {info.filled.join(", ")}
                              </span>
                            )}
                            {info.filled.length > 0 && info.missing.length > 0 && (
                              <span className="text-muted-foreground"> · </span>
                            )}
                            {info.missing.length > 0 && (
                              <span className="text-destructive">
                                ✗ {info.missing.join(", ")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Final values written to cache */}
                    {Object.keys(log.final_fields).length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Final cached values
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                          {Object.entries(log.final_fields).map(([field, present]) => (
                            <div
                              key={field}
                              className={`px-2 py-1 rounded border ${
                                present
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-destructive/30 bg-destructive/5"
                              }`}
                            >
                              <div className="text-[10px] text-muted-foreground">{field}</div>
                              <div className="font-mono text-[11px] text-foreground truncate">
                                {present ? log.final_values?.[field] ?? "—" : "missing"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
