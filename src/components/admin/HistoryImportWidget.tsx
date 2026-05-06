import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ParsedRow {
  date: string;     // raw date string from source
  price: number;    // parsed price
  iso: string;      // normalized YYYY-MM-DD for display
}

interface ParseResult {
  rows: ParsedRow[];
  invalid: number;
  invalidSamples: string[];
  detectedColumns: { date: string; price: string };
}

// ---- CSV parser (RFC-4180-ish: handles quoted fields, embedded commas, CRLF) ----
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
      else if (c === "\r") { /* swallow */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((cell) => cell && cell.trim().length > 0));
}

const DATE_KEYS = ["date", "trade date", "timestamp", "day"];
const PRICE_KEYS = ["close", "close price", "adj close", "adjusted close", "ltp", "price", "last", "close*"];

function findColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i !== -1) return i;
  }
  // fuzzy contains
  for (let i = 0; i < norm.length; i++) {
    if (candidates.some((c) => norm[i].includes(c))) return i;
  }
  return -1;
}

function normalizeDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const ymd = s.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
  let y: number, m: number, d: number;
  if (ymd) { y = +ymd[1]; m = +ymd[2]; d = +ymd[3]; }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
  else {
    const p = new Date(s);
    if (Number.isNaN(p.getTime())) return null;
    y = p.getUTCFullYear(); m = p.getUTCMonth() + 1; d = p.getUTCDate();
  }
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function normalizePrice(input: string): number | null {
  const cleaned = input.replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCsvToRows(text: string): ParseResult {
  const grid = parseCsv(text);
  if (grid.length === 0) {
    return { rows: [], invalid: 0, invalidSamples: [], detectedColumns: { date: "", price: "" } };
  }
  const headers = grid[0].map((h) => h.trim());
  const dateIdx = findColumn(headers, DATE_KEYS);
  const priceIdx = findColumn(headers, PRICE_KEYS);
  if (dateIdx === -1 || priceIdx === -1) {
    throw new Error(
      `Could not detect required columns. Found: [${headers.join(", ")}]. ` +
      `Need a date column (Date/Timestamp) and a price column (Close/LTP/Price).`,
    );
  }

  const rows: ParsedRow[] = [];
  const invalidSamples: string[] = [];
  let invalid = 0;
  const seen = new Set<string>();
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const rawDate = r[dateIdx] ?? "";
    const rawPrice = r[priceIdx] ?? "";
    const iso = normalizeDate(rawDate);
    const price = normalizePrice(rawPrice);
    if (!iso || price === null) {
      invalid++;
      if (invalidSamples.length < 3) invalidSamples.push(`row ${i + 1}: "${rawDate}" / "${rawPrice}"`);
      continue;
    }
    if (seen.has(iso)) continue; // dedupe in-file
    seen.add(iso);
    rows.push({ date: rawDate, price, iso });
  }
  rows.sort((a, b) => a.iso.localeCompare(b.iso));
  return {
    rows,
    invalid,
    invalidSamples,
    detectedColumns: { date: headers[dateIdx], price: headers[priceIdx] },
  };
}

interface ManualRow { id: string; date: string; price: string }

export const HistoryImportWidget = () => {
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");
  const [mode, setMode] = useState<"csv" | "manual">("csv");

  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [manualRows, setManualRows] = useState<ManualRow[]>([
    { id: crypto.randomUUID(), date: "", price: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFile = async (file: File) => {
    setParseError(null);
    setParsed(null);
    setResult(null);
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) {
      setParseError("File too large (max 5 MB).");
      return;
    }
    try {
      const text = await file.text();
      const result = parseCsvToRows(text);
      if (result.rows.length === 0) {
        setParseError(`No valid rows found. Invalid samples: ${result.invalidSamples.join("; ") || "none"}`);
        return;
      }
      setParsed(result);
    } catch (err: any) {
      setParseError(err?.message ?? "Failed to parse CSV.");
    }
  };

  const manualParsed = useMemo<ParsedRow[]>(() => {
    const out: ParsedRow[] = [];
    const seen = new Set<string>();
    for (const r of manualRows) {
      const iso = normalizeDate(r.date);
      const price = normalizePrice(r.price);
      if (!iso || price === null || seen.has(iso)) continue;
      seen.add(iso);
      out.push({ date: r.date, price, iso });
    }
    out.sort((a, b) => a.iso.localeCompare(b.iso));
    return out;
  }, [manualRows]);

  const rowsToSubmit = mode === "csv" ? parsed?.rows ?? [] : manualParsed;
  const tickerValid = /^[A-Z0-9_\-.]{1,30}$/.test(ticker.trim().toUpperCase());
  const canSubmit = tickerValid && rowsToSubmit.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        ticker: ticker.trim().toUpperCase(),
        exchange,
        rows: rowsToSubmit.map((r) => ({ date: r.iso, price: r.price })),
      };
      const { data, error } = await supabase.functions.invoke("import-stock-history", { body: payload });
      if (error) throw error;
      setResult(data);
      const inserted = data?.inserted ?? 0;
      const skipped = data?.skipped_existing ?? 0;
      toast.success(`Imported ${inserted} rows for ${payload.ticker} (skipped ${skipped} duplicates)`);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
      setResult({ error: err?.message ?? "Import failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Historical Prices
        </CardTitle>
        <CardDescription>
          Backfill previous-day closes for a specific ticker so the Stock Details chart shows long-range history.
          Idempotent — re-uploading the same dates skips duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hi-ticker">Ticker</Label>
            <Input
              id="hi-ticker"
              placeholder="e.g. RELIANCE"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Exchange</Label>
            <Select value={exchange} onValueChange={(v) => setExchange(v as "NSE" | "BSE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NSE">NSE</SelectItem>
                <SelectItem value="BSE">BSE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "csv" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("csv")}
          >
            <FileText className="h-4 w-4 mr-1.5" /> CSV upload
          </Button>
          <Button
            type="button"
            variant={mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("manual")}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Manual entry
          </Button>
        </div>

        {mode === "csv" && (
          <div className="space-y-2">
            <Label htmlFor="hi-file">CSV file</Label>
            <Input
              id="hi-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Required columns: a date column (<code>Date</code>, <code>Timestamp</code>, etc.) and a price column
              (<code>Close</code>, <code>LTP</code>, <code>Price</code>, <code>Adj Close</code>). Currency symbols
              and commas are stripped automatically.
            </p>
            {fileName && <p className="text-xs text-muted-foreground">File: {fileName}</p>}
            {parseError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
            {parsed && (
              <div className="rounded-md border border-border bg-muted/20 p-2 text-xs space-y-1">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{parsed.rows.length} valid rows</Badge>
                  {parsed.invalid > 0 && <Badge variant="outline">{parsed.invalid} skipped</Badge>}
                  <Badge variant="outline">date: {parsed.detectedColumns.date}</Badge>
                  <Badge variant="outline">price: {parsed.detectedColumns.price}</Badge>
                </div>
                <p className="text-muted-foreground">
                  Range: {parsed.rows[0]?.iso} → {parsed.rows[parsed.rows.length - 1]?.iso}
                </p>
                {parsed.invalidSamples.length > 0 && (
                  <p className="text-muted-foreground/80 italic">
                    Skipped samples: {parsed.invalidSamples.join("; ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-2">
            <Label>Rows (date + close price)</Label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {manualRows.map((r, idx) => (
                <div key={r.id} className="flex gap-2">
                  <Input
                    placeholder="YYYY-MM-DD"
                    value={r.date}
                    onChange={(e) => setManualRows((prev) => prev.map((x) => x.id === r.id ? { ...x, date: e.target.value } : x))}
                  />
                  <Input
                    placeholder="Close price"
                    value={r.price}
                    onChange={(e) => setManualRows((prev) => prev.map((x) => x.id === r.id ? { ...x, price: e.target.value } : x))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setManualRows((prev) => prev.length > 1 ? prev.filter((x) => x.id !== r.id) : prev)}
                    aria-label={`Remove row ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setManualRows((prev) => [...prev, { id: crypto.randomUUID(), date: "", price: "" }])}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add row
            </Button>
            <p className="text-xs text-muted-foreground">
              {manualParsed.length} valid row{manualParsed.length === 1 ? "" : "s"} ready to import.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">
            {rowsToSubmit.length > 0 && tickerValid && (
              <>Will import <strong>{rowsToSubmit.length}</strong> closes for <strong>{ticker.toUpperCase()}</strong> ({exchange}).</>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
            Import
          </Button>
        </div>

        {result && !result.error && (
          <div className="flex items-start gap-2 rounded-md border border-gain/40 bg-gain/10 p-2 text-xs">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-gain shrink-0" />
            <div className="space-y-0.5">
              <p>Inserted <strong>{result.inserted}</strong> new rows.</p>
              <p className="text-muted-foreground">
                Received {result.received} · Valid {result.valid} · Invalid {result.invalid} · Skipped duplicates {result.skipped_existing}.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoryImportWidget;
